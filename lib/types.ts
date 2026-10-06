export type SceneId = 'orbital' | 'uav' | 'ground' | 'stress';
export type Config = { seed:number; scene:SceneId; fov:number; speed:number; targets:number; turbulence:number; vibration:number; noise:number; blur:number; decoys:boolean; gain:number; };
export type TrackState = 'SEARCH' | 'ACQUIRE' | 'TRACK' | 'COAST' | 'REACQUIRE';
export type Sample = {t:number; error:number; confidence:number; processing:number; locked:number};
export type Metrics = {duration:number; frames:number; fps:number; acquisition:number|null; meanError:number; maxError:number; retention:number; availability:number; processing:number; p95:number; reacquisition:number|null; losses:number; pan:number; tilt:number; visible:boolean; aligned:boolean};
export type Frame = {type:'frame'; pixels:ArrayBuffer; width:number; height:number; state:TrackState; confidence:number; detected:{x:number;y:number;radius:number}|null; target:{az:number;el:number;x:number;y:number}; decoys:{az:number;el:number}[]; metrics:Metrics; events:{time:number;type:string;message:string}[]; sample:Sample; camera:{az:number;el:number};};
export type SavedRun = {id:string; date:string; name:string; config:Config; initialConfig?:Config; metrics:Metrics; samples:Sample[]; events:{time:number;type:string;message:string}[];};
export const DEFAULT_CONFIG:Config = {seed:26169,scene:'orbital',fov:8,speed:.55,targets:2,turbulence:0,vibration:6,noise:12,blur:6,decoys:true,gain:1};
export const SCENES:{id:SceneId;name:string;label:string;description:string;speed:number;turbulence:number;vibration:number}[] = [
{id:'orbital',name:'Orbital rendezvous',label:'SATELLITE / CONCEPT SCENE',description:'A smooth moving beacon against a deep-space background. Start here to demonstrate acquisition.',speed:.55,turbulence:0,vibration:6},
{id:'uav',name:'UAV optical link',label:'MOBILE / ATMOSPHERIC',description:'A manoeuvring target with platform vibration and atmospheric effects.',speed:.85,turbulence:22,vibration:24},
{id:'ground',name:'Ground-to-air',label:'TERMINAL / ATMOSPHERIC',description:'A moving airborne target observed from a fixed terminal with background clutter.',speed:.4,turbulence:32,vibration:10},
{id:'stress',name:'Edge of visibility',label:'STRESS / RECOVERY',description:'A faster trajectory with strong disturbances. Find the baseline’s operating limits.',speed:1.5,turbulence:40,vibration:38}
];
