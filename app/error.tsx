'use client';
export default function Error({reset}:{reset:()=>void}){return <div style={{padding:60,maxWidth:600,margin:'auto'}}><h1>Let’s restart the interface.</h1><p style={{color:'#a0b4bf',margin:'20px 0'}}>The application encountered an unexpected error. Your saved runs are kept in this browser.</p><button className="primary" onClick={reset}>Try again</button></div>;}
