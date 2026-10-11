// Original synthetic decision fixtures. No photographs or derived sample scenes.
export function fixture(id='fixture') {
 const nodes=[['a',.2,.3],['b',.4,.2],['c',.6,.4],['d',.45,.65],['e',.7,.7]].map(([id,x,y],i)=>({id,x,y,label:`vertex.${String(i+1).padStart(2,'0')}`,kind:'observation',reason:'A vertex of the synthetic test polygon.',score:1-i*.1}));
 const edges=[['a','b'],['b','c'],['c','d'],['d','a'],['d','e']].map(([a,b],i)=>({a,b,reason:`Synthetic neighbour pair ${a} to ${b}.`,weight:1-i*.1}));
 return {version:1,id,title:'Synthetic fixture',subtitle:'Unit-test geometry',image:{src:`/library/${id}/image.png`,width:240,height:180},nodes,networks:Object.fromEntries(['constellation','structure','pattern'].map(k=>[k,{title:k,meaning:'Explicit synthetic test links.',edges:structuredClone(edges)}])),focus:['a'],rules:{roles:[{role:'vertex',rule:'A visible corner of the synthetic polygon.'}],link:'Use the explicit test neighbour pairs.'}};
}
