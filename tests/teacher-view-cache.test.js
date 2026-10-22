const test=require('node:test'),assert=require('node:assert/strict');
const {createViewLoader}=require('../js/teacher-navigation');
test('warm and revisited pages reuse a request, expire quickly, and invalidate after edits',async()=>{
 let time=0,calls=0;const cache=createViewLoader(async(url)=>{calls++;return url+':'+calls;},{now:()=>time,ttl:15000,max:2});
 const [first,shared]=await Promise.all([cache.get('/courses'),cache.get('/courses')]);assert.equal(first,shared);assert.equal(calls,1);
 assert.equal(await cache.get('/courses'),first);assert.equal(calls,1);
 time=15001;assert.notEqual(await cache.get('/courses'),first);assert.equal(calls,2);
 cache.clear();await cache.get('/courses');assert.equal(calls,3);
 cache.prime('/home','initial HTML');assert.equal(await cache.get('/home'),'initial HTML');assert.equal(calls,3);
 await cache.get('/calendar');await cache.get('/courses');assert.equal(calls,5);
});
test('failed or invalidated in-flight loads do not poison subsequent navigation',async()=>{
 let calls=0,release;const cache=createViewLoader(async()=>{calls++;if(calls===1)throw Error('session expired');if(calls===2)return new Promise(resolve=>release=resolve);return 'fresh';});
 await assert.rejects(cache.get('/home'));const pending=cache.get('/home');await Promise.resolve();cache.clear();release('old');await pending;assert.equal(await cache.get('/home'),'fresh');assert.equal(calls,3);
});
