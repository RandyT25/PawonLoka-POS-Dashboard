import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) {
    // Module fetch failures (stale SW cache) are always fixed by a fresh reload
    if (e?.message?.includes('dynamically imported module') || e?.message?.includes('Failed to fetch')) {
      window.location.reload()
      return { error: null }
    }
    return { error: e }
  }
  render() {
    if (this.state.error) return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",flexDirection:"column",gap:16,fontFamily:"sans-serif",padding:24}}>
        <div style={{fontSize:32}}>⚠️</div>
        <div style={{fontSize:18,fontWeight:700,color:"#DC2626"}}>Something went wrong</div>
        <div style={{fontSize:13,color:"#6B7280",maxWidth:400,textAlign:"center"}}>{this.state.error.message}</div>
        <button onClick={()=>window.location.reload()} style={{padding:"10px 24px",background:"#3B82F6",color:"#fff",border:"none",borderRadius:8,fontSize:14,cursor:"pointer",fontWeight:600}}>Reload App</button>
      </div>
    )
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
