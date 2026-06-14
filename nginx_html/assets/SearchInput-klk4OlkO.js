import{c as l,j as e,X as i,A as p}from"./index-BYV_Lwx3.js";/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=l("Search",[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["path",{d:"m21 21-4.3-4.3",key:"1qie3q"}]]),y=({value:a,onChange:s,placeholder:c="Buscar...",className:n,autoFocus:o,onEnter:r})=>e.jsxs("div",{className:p("relative",n),children:[e.jsx(x,{className:"absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"}),e.jsx("input",{type:"text",value:a,onChange:t=>s(t.target.value),placeholder:c,autoFocus:o,onKeyDown:t=>{t.key==="Enter"&&r&&r()},className:"input-field pl-9 pr-8"}),a&&e.jsx("button",{onClick:()=>s(""),className:"absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded",children:e.jsx(i,{className:"w-3.5 h-3.5 text-gray-400"})})]});export{y as S,x as a};
