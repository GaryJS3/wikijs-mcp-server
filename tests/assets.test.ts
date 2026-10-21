import { describe, expect, it, vi, afterEach } from 'vitest';
import { WikiJsAssets } from '../src/services/assets.js';

const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
const response=(data:unknown)=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
afterEach(()=>vi.unstubAllGlobals());

describe('Wiki.js asset service',()=>{
  it('uploads verified PNG bytes through /u and verifies the resulting asset',async()=>{
    const calls:Array<{url:string;body:any}>=[];
    vi.stubGlobal('fetch',vi.fn(async(input:any,init:any)=>{
      const url=String(input); calls.push({url,body:init?.body});
      if(url.endsWith('/u')) return new Response('ok');
      const query=JSON.parse(init.body).query;
      if(query.includes('list(')) return response({data:{assets:{list:calls.some(c=>c.url.endsWith('/u'))?[{id:9,filename:'map.png',ext:'png',kind:'IMAGE',mime:'image/png',fileSize:png.length,folder:null}]:[]}}});
      throw new Error(`Unexpected request: ${query}`);
    }));
    const service=new WikiJsAssets('https://wiki.example/prefix/graphql','secret');
    const result=await service.upload({filename:'map.png',base64Data:png.toString('base64')});
    expect(calls.some(c=>c.url==='https://wiki.example/prefix/u')).toBe(true);
    const form=calls.find(c=>c.url.endsWith('/u'))!.body as FormData;
    expect(form.get('mediaUpload')).toBe(JSON.stringify({folderId:0}));
    expect(result.id).toBe(9); expect(result.relativeUrl).toBe('/map.png'); expect(result.absoluteUrl).toBe('https://wiki.example/prefix/map.png');
  });
  it('rejects malformed base64, non-image content and overwrite requests',async()=>{
    const service=new WikiJsAssets('https://wiki.example/graphql','secret');
    await expect(service.upload({filename:'a.png',base64Data:'not base64!'})).rejects.toThrow('Malformed Base64');
    await expect(service.upload({filename:'a.png',base64Data:Buffer.from('plain').toString('base64')})).rejects.toThrow('Unsupported or invalid image');
    await expect(service.upload({filename:'a.png',base64Data:png.toString('base64'),overwrite:true})).rejects.toThrow('never replaced');
  });
  it('rejects loopback URLs before making a request',async()=>{
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    const service=new WikiJsAssets('https://wiki.example/graphql','secret');
    await expect(service.upload({filename:'a.png',sourceUrl:'http://127.0.0.1/a.png'})).rejects.toThrow('private or reserved');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('handles unsuccessful Wiki.js responseResult values',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(_input:any,init:any)=>response({data:{assets:{createFolder:{responseResult:{succeeded:false,message:'denied'}}}}})));
    const service=new WikiJsAssets('https://wiki.example/graphql','secret');
    await expect(service.createFolder('nested')).rejects.toThrow('Failed to create folder: denied');
  });
});
