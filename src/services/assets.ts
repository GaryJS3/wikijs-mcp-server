import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

export interface Asset { id: number; filename: string; ext: string; kind: string; mime: string; fileSize: number; createdAt?: string; updatedAt?: string; folder?: { id: number; slug: string; name?: string } | null }
export interface AssetFolder { id: number; slug: string; name?: string | null }

const MAX_DEFAULT = 10 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const QUERY_ASSET = 'id filename ext kind mime fileSize createdAt updatedAt folder { id slug name }';

function safePath(path = ''): string[] {
  const parts = path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  if (parts.some((part) => part === '.' || part === '..' || /[\\\0]/.test(part) || !/^[\p{L}\p{N}_ -]+$/u.test(part))) throw new Error('Invalid asset folder path');
  return parts;
}
function safeFilename(name: string): string {
  if (!name || name.length > 255 || name === '.' || name === '..' || /[/\\\0]/.test(name) || /[\r\n]/.test(name)) throw new Error('Invalid filename');
  return name;
}
function isPrivate(address: string): boolean {
  if (address.startsWith('::ffff:')) return isPrivate(address.slice(7));
  if (address.includes(':')) return address === '::' || address === '::1' || !/^2[0-9a-f]{3}:/i.test(address) || /^2001:(?:0?db8|0?2):/i.test(address) || /^(fc|fd|fe[89ab])/i.test(address);
  const [a,b] = address.split('.').map(Number);
  const c=Number(address.split('.')[2]);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b! >= 64 && b! <= 127) || (a === 169 && b === 254) || (a === 172 && b! >= 16 && b! <= 31) || (a === 192 && (b === 0 || b === 168)) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113) || a! >= 224;
}
function mimeFromBytes(data: Buffer): string | undefined {
  if (data.length >= 8 && data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return 'image/jpeg';
  if (data.length >= 6 && ['GIF87a','GIF89a'].includes(data.toString('ascii',0,6))) return 'image/gif';
  if (data.length >= 12 && data.toString('ascii',0,4) === 'RIFF' && data.toString('ascii',8,12) === 'WEBP') return 'image/webp';
  return undefined;
}
function downloadPinned(url: URL, address: string, family: number, maxBytes: number, timeoutMs: number): Promise<{status:number;location?:string;data?:Buffer}> {
  return new Promise((resolve,reject)=>{
    const request=(url.protocol==='https:'?httpsRequest:httpRequest)(url,{method:'GET',lookup:(_host,_options,callback)=>callback(null,address,family),timeout:timeoutMs,headers:{'User-Agent':'wikijs-mcp-server asset importer'}} ,response=>{
      const status=response.statusCode??0; const location=response.headers.location;
      if([301,302,303,307,308].includes(status)){response.resume();resolve({status,location});return;}
      if(status<200||status>=300){response.resume();resolve({status});return;}
      const length=Number(response.headers['content-length']); if(Number.isFinite(length)&&length>maxBytes){request.destroy(new Error('Remote file exceeds configured maximum size'));return;}
      const chunks:Buffer[]=[];let size=0;
      response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>maxBytes){request.destroy(new Error('Remote file exceeds configured maximum size'));return;}chunks.push(chunk);});
      response.on('end',()=>resolve({status,data:Buffer.concat(chunks)}));
    });
    request.on('timeout',()=>request.destroy(new Error('Remote source request timed out')));request.on('error',reject);request.end();
  });
}

export class WikiJsAssets {
  private readonly maxBytes: number;
  private readonly timeoutMs: number;
  private readonly siteUrl: URL;
  constructor(private readonly apiUrl: string, private readonly token: string, maxBytes = MAX_DEFAULT, timeoutMs = 30_000, private readonly allowRemote = true) {
    this.maxBytes = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : MAX_DEFAULT; this.timeoutMs = timeoutMs; this.siteUrl = new URL(apiUrl);
  }
  private async gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(this.apiUrl, { method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({query, variables}), signal: AbortSignal.timeout(this.timeoutMs) });
    if (!response.ok) throw new Error(`Wiki.js API returned HTTP ${response.status}`);
    const result = await response.json() as {data?: T; errors?: Array<{message:string}>};
    if (result.errors?.length) throw new Error(`Wiki.js GraphQL failed: ${result.errors.map((e)=>e.message).join('; ')}`);
    if (!result.data) throw new Error('Wiki.js returned no GraphQL data');
    return result.data;
  }
  async folders(parentFolderId: number): Promise<AssetFolder[]> { const d = await this.gql<{assets:{folders:AssetFolder[]}}>('query($parentFolderId:Int!){assets{folders(parentFolderId:$parentFolderId){id slug name}}}',{parentFolderId}); return d.assets.folders ?? []; }
  async resolveFolder(path: string, create = false): Promise<{id:number; path:string}> {
    const parts = safePath(path); let id = 0; const found: string[] = [];
    for (const part of parts) {
      const folders = await this.folders(id); let folder = folders.find(f => f.slug.toLowerCase() === part.toLowerCase());
      if (!folder && create) {
        const d = await this.gql<{assets:{createFolder:{responseResult:{succeeded:boolean;message:string}}}}>('mutation($parentFolderId:Int!,$slug:String!,$name:String){assets{createFolder(parentFolderId:$parentFolderId,slug:$slug,name:$name){responseResult{succeeded message}}}}',{parentFolderId:id,slug:part.toLowerCase(),name:part});
        const r=d.assets.createFolder.responseResult; if (!r.succeeded && !/exists/i.test(r.message)) throw new Error(`Failed to create folder: ${r.message}`);
        folder = (await this.folders(id)).find(f=>f.slug.toLowerCase()===part.toLowerCase());
      }
      if (!folder) throw new Error(`Asset folder not found: ${[...found,part].join('/')}`);
      id=folder.id; found.push(folder.slug);
    }
    return {id,path:found.join('/')};
  }
  async list(folderPath = '', limit = 50, offset = 0): Promise<{assets:Asset[];total:number;folderPath:string}> {
    const folder=await this.resolveFolder(folderPath); const d=await this.gql<{assets:{list:Asset[]}}>('query($folderId:Int!){assets{list(folderId:$folderId,kind:ALL){'+QUERY_ASSET+'}}}',{folderId:folder.id});
    const all=d.assets.list??[]; return {assets:all.slice(offset,offset+limit).map(a=>({...a, url:this.assetUrl(folder.path,a.filename)} as Asset)),total:all.length,folderPath:folder.path};
  }
  async allFolders(parentPath = ''): Promise<Array<AssetFolder & {path:string}>> {
    const parent=await this.resolveFolder(parentPath); const folders=await this.folders(parent.id);
    return folders.map(f=>({...f,path:[parent.path,f.slug].filter(Boolean).join('/')}));
  }
  async createFolder(path:string, recursive=true): Promise<{id:number;path:string}> {
    const parts=safePath(path); if (!recursive && parts.length>1) throw new Error('recursive=false only supports a folder directly under the root');
    return this.resolveFolder(parts.join('/'),true);
  }
  assetUrl(folder:string, filename:string): string { return `/${[...safePath(folder),safeFilename(filename)].map(encodeURIComponent).join('/')}`; }
  absoluteUrl(relative:string):string { const base=new URL(this.siteUrl); base.pathname=base.pathname.replace(/\/graphql\/?$/i,'/').replace(/\/$/,'') + relative; return base.toString(); }
  private uploadUrl():string { const u=new URL(this.apiUrl); u.pathname=u.pathname.replace(/\/graphql\/?$/i,'/u'); return u.toString(); }
  private async source(sourceUrl?:string, base64Data?:string):Promise<Buffer> {
    if (!!sourceUrl === !!base64Data) throw new Error('Provide exactly one of sourceUrl or base64Data');
    if (base64Data !== undefined) {
      if (base64Data.length > Math.ceil(this.maxBytes / 3) * 4 + 4) throw new Error('Upload exceeds configured maximum size');
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64Data)) throw new Error('Malformed Base64 data');
      const b=Buffer.from(base64Data,'base64'); if(b.length>this.maxBytes) throw new Error('Upload exceeds configured maximum size'); return b;
    }
    if (!this.allowRemote) throw new Error('Remote asset URLs are disabled by configuration');
    let url=new URL(sourceUrl!);
    for(let redirects=0;redirects<=3;redirects++) {
      if(url.protocol!=='https:' && url.protocol!=='http:') throw new Error('Only HTTP and HTTPS source URLs are supported');
      if(url.username || url.password || url.hostname==='localhost' || url.hostname.endsWith('.localhost')) throw new Error('Unsafe remote source URL');
      const addresses=isIP(url.hostname)?[{address:url.hostname,family:isIP(url.hostname)}]:await lookup(url.hostname,{all:true});
      if(!addresses.length || addresses.some(x=>isPrivate(x.address))) throw new Error('Remote source resolves to a private or reserved address');
      const result=await downloadPinned(url,addresses[0]!.address,addresses[0]!.family,this.maxBytes,this.timeoutMs);
      if([301,302,303,307,308].includes(result.status)) { if(!result.location||redirects===3) throw new Error('Remote source redirect rejected'); url=new URL(result.location,url); continue; }
      if(result.status<200||result.status>=300) throw new Error(`Remote source returned HTTP ${result.status}`);
      return result.data!;
    }
    throw new Error('Remote source redirect rejected');
  }
  async upload(input:{filename:string;folderPath?:string;sourceUrl?:string;base64Data?:string;mimeType?:string;createFolders?:boolean;overwrite?:boolean}) {
    const filename=safeFilename(input.filename); if(input.overwrite) throw new Error('overwrite=true is not supported; existing assets are never replaced');
    const data=await this.source(input.sourceUrl,input.base64Data); const mime=mimeFromBytes(data);
    if(!mime || !ALLOWED.has(mime) || (input.mimeType && input.mimeType.toLowerCase()!==mime)) throw new Error('Unsupported or invalid image content; allowed types are PNG, JPEG, GIF, and WebP');
    const extension=filename.includes('.')?filename.split('.').pop()!.toLowerCase():'';
    const expectedExtension:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp'};
    if(extension && ![expectedExtension[mime],...(mime==='image/jpeg'?['jpeg']:[])].includes(extension)) throw new Error('Filename extension does not match the detected image content');
    const folder=await this.resolveFolder(input.folderPath??'',input.createFolders??true);
    const existing=await this.list(folder.path,10000,0); if(existing.assets.some(a=>a.filename.toLowerCase()===filename.toLowerCase())) throw new Error(`Asset already exists: ${filename}`);
    const form=new FormData(); form.append('mediaUpload',JSON.stringify({folderId:folder.id})); form.append('mediaUpload',new Blob([data],{type:mime}),filename);
    const response=await fetch(this.uploadUrl(),{method:'POST',headers:{Authorization:`Bearer ${this.token}`},body:form,signal:AbortSignal.timeout(this.timeoutMs)});
    if(!response.ok) throw new Error(`Wiki.js upload returned HTTP ${response.status}`);
    const after=await this.list(folder.path,10000,0); const asset=after.assets.find(a=>a.filename.toLowerCase()===filename.toLowerCase()); if(!asset) throw new Error('Upload response succeeded but the asset could not be verified');
    const relative=this.assetUrl(folder.path,asset.filename); return {id:asset.id,filename:asset.filename,mimeType:asset.mime||mime,fileSize:asset.fileSize,folderPath:folder.path,relativeUrl:relative,absoluteUrl:this.absoluteUrl(relative),markdown:`![${asset.filename}](${relative})`,html:`<img src="${relative}" alt="${asset.filename}" style="max-width:100%;height:auto;">`};
  }
  async rename(id:number,filename:string) { safeFilename(filename); const current=await this.findById(id); const folderPath=await this.pathForFolder(current.folder?.id??0); const folder=await this.resolveFolder(folderPath); const listing=await this.list(folder.path,10000,0); if(listing.assets.some(a=>a.id!==id&&a.filename.toLowerCase()===filename.toLowerCase())) throw new Error(`Asset already exists: ${filename}`); await this.mutation('renameAsset','id:Int!,filename:String!','id:$id,filename:$filename',{id,filename}); const updated=await this.findById(id); return {...updated,url:this.assetUrl(folder.path,updated.filename)}; }
  async delete(id:number,confirm:boolean) { if(!confirm)throw new Error('Set confirm=true to delete this asset'); await this.findById(id); await this.mutation('deleteAsset','id:Int!','id:$id',{id}); return {id,deleted:true}; }
  private async mutation(name:string,vars:string,args:string,variables:Record<string,unknown>) { const d=await this.gql<Record<string,Record<string,{responseResult:{succeeded:boolean;message:string}}>>>(`mutation($${vars}){assets{${name}(${args}){responseResult{succeeded message}}}}`,variables); const r=d.assets[name].responseResult; if(!r.succeeded)throw new Error(`Wiki.js ${name} failed: ${r.message}`); }
  private async findById(id:number):Promise<Asset> {
    const visit=async(folderId:number):Promise<Asset|undefined>=>{
      const d=await this.gql<{assets:{list:Asset[]}}>('query($folderId:Int!){assets{list(folderId:$folderId,kind:ALL){'+QUERY_ASSET+'}}}',{folderId});
      const asset=d.assets.list.find(x=>x.id===id);if(asset)return asset;
      for(const folder of await this.folders(folderId)){const nested=await visit(folder.id);if(nested)return nested;}
      return undefined;
    };
    const result=await visit(0);if(!result)throw new Error(`Asset not found: ${id}`);return result;
  }
  private async pathForFolder(id:number):Promise<string> {
    if(id===0)return '';
    const search=async(parentId:number,prefix:string):Promise<string|undefined>=>{
      for(const folder of await this.folders(parentId)) { const path=[prefix,folder.slug].filter(Boolean).join('/'); if(folder.id===id)return path; const found=await search(folder.id,path);if(found!==undefined)return found; }
      return undefined;
    };
    const found=await search(0,'');if(found===undefined)throw new Error('Asset folder path could not be resolved');return found;
  }
}
