import { z } from 'zod';
import type { WikiJsAssets } from '../services/assets.js';
import type { WikiJsClient } from '../services/client.js';
import { handleToolError, successResponse } from '../services/error-handler.js';

export const insertAssetSchema = z.object({
  pageId: z.number().int().positive().optional(), pagePath: z.string().min(1).optional(), locale: z.string().default('en'),
  assetId: z.number().int().positive().optional(), sourceUrl: z.string().url().optional(), base64Data: z.string().optional(),
  filename: z.string().min(1).max(255).optional(), folderPath: z.string().optional(), altText: z.string().max(1000).default(''),
  caption: z.string().max(2000).optional(), width: z.number().int().positive().max(10000).optional(),
  position: z.enum(['append','prepend','before','after','replace']).default('append'), anchorText: z.string().min(1).optional(), dryRun: z.boolean().default(true),
}).superRefine((v,ctx)=>{
  if (!!v.pageId === !!v.pagePath) ctx.addIssue({code:z.ZodIssueCode.custom,message:'Provide exactly one of pageId or pagePath'});
  if ([v.assetId,v.sourceUrl,v.base64Data].filter(x=>x!==undefined).length!==1) ctx.addIssue({code:z.ZodIssueCode.custom,message:'Provide exactly one image source: assetId, sourceUrl, or base64Data'});
  if (!v.assetId && !v.filename) ctx.addIssue({code:z.ZodIssueCode.custom,message:'filename is required when uploading an image'});
  if (['before','after','replace'].includes(v.position) && !v.anchorText) ctx.addIssue({code:z.ZodIssueCode.custom,message:`anchorText is required for ${v.position}`});
});
export const insertAssetToolDefinition={name:'wikijs_insert_asset',description:'Insert an existing or newly uploaded image into a Wiki.js page. dryRun defaults to true. The replace position replaces only the exact anchorText match. Page updates have best-effort conflict detection; Wiki.js does not expose a conditional revision update through this API, and upload plus page update cannot be atomic.',inputSchema:insertAssetSchema,annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true}};

type Input=z.infer<typeof insertAssetSchema>;
const html=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const mdAlt=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\[/g,'\\[').replace(/\]/g,'\\]').replace(/\n/g,' ');
function makeMarkup(format:'markdown'|'html',url:string,alt:string,caption:string|undefined,width:number|undefined):string {
  if(format==='html') return `<figure><img src="${html(url)}" alt="${html(alt)}"${width?` width="${width}"`:''}${width?'':' style="max-width:100%;height:auto;"'}>${caption?`<figcaption>${html(caption)}</figcaption>`:''}</figure>`;
  if(width||caption) return `<img src="${html(url)}" alt="${html(alt)}"${width?` width="${width}"`:''}${width?'':' style="max-width:100%;height:auto;"'}>${caption?`\n\n*${caption.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\/g,'\\\\').replace(/([*_`])/g,'\\$1')}*`:''}`;
  return `![${mdAlt(alt)}](${url})`;
}
function insert(content:string,markup:string,position:Input['position'],anchor?:string):string {
  if(position==='append') return `${content}${content&&!content.endsWith('\n')?'\n':''}${content?'\n':''}${markup}\n`;
  if(position==='prepend') return `${markup}\n\n${content}`;
  const at=content.indexOf(anchor!); if(at<0) throw new Error('anchorText was not found; page was not changed');
  if(content.indexOf(anchor!,at+anchor!.length)>=0) throw new Error('anchorText matched multiple locations; page was not changed');
  const lineStart=content.lastIndexOf('\n',at-1)+1, lineEnd0=content.indexOf('\n',at), lineEnd=lineEnd0<0?content.length:lineEnd0;
  const line=content.slice(lineStart,lineEnd);
  const heading=/^\s{0,3}#{1,6}\s+.*(?:\s+#+)?\s*$/.test(line) || /^\s*<h[1-6](?:\s[^>]*)?>.*<\/h[1-6]>\s*$/i.test(line);
  if(heading) { const point=lineEnd; return content.slice(0,point)+`\n\n${markup}`+content.slice(point); }
  if(position==='replace') return content.slice(0,at)+markup+content.slice(at+anchor!.length);
  if(position==='before') return content.slice(0,at)+markup+'\n\n'+content.slice(at);
  return content.slice(0,at+anchor!.length)+'\n\n'+markup+content.slice(at+anchor!.length);
}
function preview(content:string,markup:string):string { const i=content.indexOf(markup);return content.slice(Math.max(0,i-160),Math.min(content.length,i+markup.length+160)); }
export async function handleInsertAsset(client:WikiJsClient,assets:WikiJsAssets,args:Input) {
  let uploaded:{id:number;absoluteUrl:string}|undefined;
  try {
    const input=insertAssetSchema.parse(args);
    const page=input.pageId?await client.getPageById(input.pageId,false):await client.getPageByPath(input.pagePath!,input.locale,false);
    if(!page) throw new Error(`Page not found${input.pagePath?` at path: ${input.pagePath}`:` with ID: ${input.pageId}`}`);
    if(page.content==null) throw new Error(`Page ${page.id} has no readable source content`);
    const raw=(page.contentType??'').toLowerCase();
    const format=raw==='markdown'?'markdown':raw==='html'?'html':undefined;
    if(!format) throw new Error(`Unsupported page format: ${page.contentType??'(missing contentType)'}. Only Markdown and HTML pages are supported.`);
    let asset:{id:number;relativeUrl:string;absoluteUrl:string};
    if(input.assetId) { const a=await assets.getById(input.assetId);asset=a; }
    else if(input.dryRun) { const filename=input.filename!; const provisional=assets.assetUrl(input.folderPath??'',filename);asset={id:0,relativeUrl:provisional,absoluteUrl:assets.absoluteUrl(provisional)}; }
    else { const a=await assets.upload({filename:input.filename!,folderPath:input.folderPath,sourceUrl:input.sourceUrl,base64Data:input.base64Data});uploaded={id:a.id,absoluteUrl:a.absoluteUrl};asset={id:a.id,relativeUrl:a.relativeUrl,absoluteUrl:a.absoluteUrl}; }
    const markup=makeMarkup(format,asset.relativeUrl,input.altText,input.caption,input.width);
    const ref=asset.relativeUrl;
    const proposed=insert(page.content,markup,input.position,input.anchorText);
    if(page.content.includes(ref)) return successResponse({pageId:page.id,assetId:asset.id||undefined,assetUrl:asset.absoluteUrl,insertedMarkup:markup,position:input.position,applied:false,dryRun:input.dryRun,duplicate:true,preview:preview(page.content,ref)});
    if(input.dryRun) return successResponse({pageId:page.id,assetId:asset.id||undefined,assetUrl:asset.absoluteUrl,insertedMarkup:markup,position:input.position,applied:false,dryRun:true,provisionalUrl:!input.assetId,preview:preview(proposed,markup)});
    if(page.updatedAt && typeof (client as WikiJsClient & {checkPageConflicts?:unknown}).checkPageConflicts==='function') {
      try {
        const conflict=await client.checkPageConflicts(page.id,page.updatedAt);
        if(conflict) throw new Error('Wiki.js reports that the page changed after it was read; refusing to overwrite a stale revision. Retry with the latest page.');
      } catch(error) {
        if(!(error instanceof Error) || !/checkConflicts|Cannot query field|Unknown field/i.test(error.message)) throw error;
      }
    }
    const latest=await client.getPageById(page.id,false);
    if(!latest||latest.content!==page.content||latest.updatedAt!==page.updatedAt) throw new Error('Page changed after it was read; refusing to overwrite a stale revision. Retry with the latest page. Wiki.js update is not atomic with its conflict check, so a race remains.');
    try {
      await client.updatePage({id:page.id,content:proposed,title:page.title,description:page.description,isPublished:page.isPublished,tags:page.tags??[],expectedContent:page.content,expectedUpdatedAt:page.updatedAt??undefined});
      const verified=await client.getPageById(page.id,false);
      if(!verified?.content?.includes(ref)) throw new Error('Page update completed but the inserted image reference could not be verified');
      return successResponse({pageId:page.id,assetId:asset.id,assetUrl:asset.absoluteUrl,insertedMarkup:markup,position:input.position,applied:true,dryRun:false,verified:true});
    } catch(error) {
      if(uploaded) return {content:[{type:'text' as const,text:JSON.stringify({success:false,partialFailure:true,pageId:page.id,assetId:uploaded.id,assetUrl:uploaded.absoluteUrl,insertedMarkup:markup,position:input.position,applied:false,error:error instanceof Error?error.message:String(error),uploadedAssetId:uploaded.id,retryWithAssetId:uploaded.id})}],structuredContent:{success:false,partialFailure:true,pageId:page.id,assetId:uploaded.id,assetUrl:uploaded.absoluteUrl,insertedMarkup:markup,position:input.position,applied:false,error:error instanceof Error?error.message:String(error),uploadedAssetId:uploaded.id,retryWithAssetId:uploaded.id},isError:true};
      throw error;
    }
  } catch(error) { return handleToolError(error,'wikijs_insert_asset'); }
}
