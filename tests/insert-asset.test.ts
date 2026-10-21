import { describe, expect, it, vi } from 'vitest';
import { handleInsertAsset } from '../src/tools/insert-asset.js';
import { WikiJsAssets } from '../src/services/assets.js';
import type { WikiJsClient } from '../src/services/client.js';

const page=(content='hello world',contentType='markdown')=>({id:7,path:'guide',title:'Guide',description:'desc',content,contentType,isPublished:true,locale:'en',tags:['docs']});
function setup(content='hello world',contentType='markdown') {
  let current=page(content,contentType); const update=vi.fn(async(p:any)=>{current={...current,content:p.content};return{succeeded:true,errorCode:0,message:'ok'};});
  const client={getPageById:vi.fn(async()=>current),getPageByPath:vi.fn(async()=>current),updatePage:update} as unknown as WikiJsClient;
  const assets={getById:vi.fn(async()=>({id:9,filename:'pic.png',mimeType:'image/png',relativeUrl:'/assets/pic.png',absoluteUrl:'https://wiki.example/assets/pic.png'})),assetUrl:(f:string,n:string)=>`/${[f,n].filter(Boolean).join('/')}`,absoluteUrl:(u:string)=>`https://wiki.example${u}`,upload:vi.fn(async()=>({id:10,relativeUrl:'/new.png',absoluteUrl:'https://wiki.example/new.png'}))} as unknown as WikiJsAssets;
  return {client,assets,update,current:()=>current};
}
const args=(x:any={})=>({pageId:7,assetId:9,dryRun:false,...x});
const call=(s:ReturnType<typeof setup>,a:any)=>handleInsertAsset(s.client,s.assets,a);
describe('wikijs_insert_asset',()=>{
  it('inserts existing assets and preserves page metadata',async()=>{const s=setup();const r:any=await call(s,args());expect(r.structuredContent.applied).toBe(true);expect(s.current().content).toContain('![](/assets/pic.png)');expect(s.update).toHaveBeenCalledWith(expect.objectContaining({title:'Guide',description:'desc',tags:['docs'],expectedContent:'hello world'}));});
  it('uploads and inserts; reports recoverable partial failure',async()=>{const s=setup();const r:any=await call(s,args({assetId:undefined,filename:'new.png',base64Data:'eA=='}));expect(s.assets.upload).toHaveBeenCalled();expect(r.structuredContent.assetId).toBe(10);
    const broken=setup();broken.update.mockRejectedValueOnce(new Error('update failed'));const partial:any=await call(broken,args({assetId:undefined,filename:'new.png',base64Data:'eA=='}));expect(partial.structuredContent).toMatchObject({partialFailure:true,uploadedAssetId:10,retryWithAssetId:10});});
  it('formats Markdown and HTML with captions, widths, and escaped attributes',async()=>{let s=setup();let r:any=await call(s,args({altText:'a "photo"',caption:'caption',width:320}));expect(r.structuredContent.insertedMarkup).toContain('alt="a &quot;photo&quot;"');expect(r.structuredContent.insertedMarkup).toContain('width="320"');
    s=setup('start','html');r=await call(s,args({altText:'<x>',caption:'<script>',width:200}));expect(r.structuredContent.insertedMarkup).toContain('&lt;x&gt;');expect(r.structuredContent.insertedMarkup).toContain('&lt;script&gt;');expect(r.structuredContent.insertedMarkup).toContain('<figcaption>');});
  it.each(['append','prepend','before','after','replace'] as const)('supports %s placement',async position=>{const s=setup('alpha\nbeta');const r:any=await call(s,args({position,anchorText:position==='append'||position==='prepend'?undefined:'beta'}));expect(r.structuredContent.applied).toBe(true);const c=s.current().content;expect(c).toContain('![](/assets/pic.png)');if(position==='replace')expect(c).not.toContain('beta');});
  it('places an anchored heading image beneath the heading',async()=>{const s=setup('# Heading\nbody');await call(s,args({position:'before',anchorText:'# Heading'}));expect(s.current().content).toMatch(/^# Heading\n\n!\[\]/);});
  it('rejects absent and ambiguous anchors',async()=>{for(const content of ['one','same same']){const s=setup(content);const r:any=await call(s,args({position:'after',anchorText:content==='one'?'missing':'same'}));expect(r.isError).toBe(true);expect(s.update).not.toHaveBeenCalled();}});
  it('dry-runs uploads without mutation and identifies provisional URLs',async()=>{const s=setup();const r:any=await call(s,args({assetId:undefined,filename:'draft.png',base64Data:'eA==',dryRun:true}));expect(s.assets.upload).not.toHaveBeenCalled();expect(s.update).not.toHaveBeenCalled();expect(r.structuredContent.provisionalUrl).toBe(true);});
  it('skips duplicate asset references and rejects unsupported formats',async()=>{let s=setup('![already](/assets/pic.png)');let r:any=await call(s,args());expect(r.structuredContent.duplicate).toBe(true);expect(s.update).not.toHaveBeenCalled();s=setup('body','ckeditor');r=await call(s,args());expect(r.isError).toBe(true);expect(r.structuredContent.error).toContain('Unsupported page format');});
  it('detects changes between initial read and update',async()=>{const s=setup();s.client.getPageById=vi.fn().mockResolvedValueOnce(page()).mockResolvedValueOnce(page('concurrent edit'));const r:any=await call(s,args());expect(r.isError).toBe(true);expect(s.update).not.toHaveBeenCalled();});
  it('uses Wiki.js revision conflict checks when a page timestamp is available',async()=>{const s=setup();const p={...page(),updatedAt:'2026-10-20T10:00:00.000Z'};s.client.getPageById=vi.fn().mockResolvedValue(p);(s.client as any).checkPageConflicts=vi.fn().mockResolvedValue(true);const r:any=await call(s,args());expect((s.client as any).checkPageConflicts).toHaveBeenCalledWith(7,p.updatedAt);expect(r.isError).toBe(true);expect(s.update).not.toHaveBeenCalled();});
  it('validates exactly one page/image source and anchored parameters',async()=>{const s=setup();const r:any=await call(s,{pageId:7,assetId:9,sourceUrl:'https://x.test/a',position:'replace',dryRun:true});expect(r.isError).toBe(true);expect(r.structuredContent.error).toContain('exactly one');});
});
