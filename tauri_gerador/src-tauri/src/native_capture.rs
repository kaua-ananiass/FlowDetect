//! Primary-monitor DXGI capture. Only local IPC consumes these raw NV12 frames;
//! the network transport remains encrypted WebRTC video, never JPEG snapshots.
#[cfg(windows)]
mod platform {
    use windows::{core::Interface,Win32::{Foundation::HMODULE,Graphics::{
        Direct3D::D3D_DRIVER_TYPE_UNKNOWN,Direct3D11::*,Dxgi::*}}};
    pub struct Capture {
        device:ID3D11Device,context:ID3D11DeviceContext,dup:IDXGIOutputDuplication,
        staging:Option<ID3D11Texture2D>,size:(u32,u32),
    }
    impl Capture {
        pub fn new()->Result<Self,String>{unsafe{
            let factory:IDXGIFactory1=CreateDXGIFactory1().map_err(|e|e.to_string())?;
            for ai in 0..16 {
                let Ok(adapter)=factory.EnumAdapters1(ai) else {break};
                for oi in 0..16 {
                    let Ok(output)=adapter.EnumOutputs(oi) else {break};
                    let Ok(desc)=output.GetDesc() else {continue};
                    if !desc.AttachedToDesktop.as_bool() || desc.DesktopCoordinates.left!=0 || desc.DesktopCoordinates.top!=0 {continue;}
                    let mut device=None;let mut context=None;
                    D3D11CreateDevice(&adapter.cast::<IDXGIAdapter>().map_err(|e|e.to_string())?,D3D_DRIVER_TYPE_UNKNOWN,
                        HMODULE::default(),D3D11_CREATE_DEVICE_BGRA_SUPPORT,None,D3D11_SDK_VERSION,
                        Some(&mut device),None,Some(&mut context)).map_err(|e|e.to_string())?;
                    let device=device.ok_or("D3D11 device ausente")?;
                    let out:IDXGIOutput1=output.cast().map_err(|e|e.to_string())?;
                    let dup=out.DuplicateOutput(&device).map_err(|e|format!("Nao foi possivel capturar esta sessao Windows: {e}"))?;
                    return Ok(Self{device,context:context.ok_or("Contexto D3D11 ausente")?,dup,staging:None,size:(0,0)});
                }
            }
            Err("Monitor principal indisponivel. Mantenha a sessao Windows aberta e desbloqueada.".into())
        }}
        pub fn frame(&mut self)->Result<Vec<u8>,String>{unsafe{
            let mut info=DXGI_OUTDUPL_FRAME_INFO::default();let mut resource=None;
            if let Err(error)=self.dup.AcquireNextFrame(100,&mut info,&mut resource){
                if error.code()==DXGI_ERROR_WAIT_TIMEOUT {return Ok(Vec::new());}
                return Err(format!("Captura interrompida (tela bloqueada, monitor ou driver): {error}"));
            }
            let result=(||->Result<Vec<u8>,String>{
                let texture:ID3D11Texture2D=resource.ok_or("DXGI nao retornou textura")?.cast().map_err(|e|e.to_string())?;
                let mut desc=D3D11_TEXTURE2D_DESC::default();texture.GetDesc(&mut desc);
                if desc.Width>7680 || desc.Height>4320 {return Err("Resolucao acima do limite de captura".into());}
                if self.size!=(desc.Width,desc.Height) {
                    let stage_desc=D3D11_TEXTURE2D_DESC{Usage:D3D11_USAGE_STAGING,BindFlags:0,
                        CPUAccessFlags:D3D11_CPU_ACCESS_READ.0 as u32,MiscFlags:0,..desc};
                    let mut stage=None;self.device.CreateTexture2D(&stage_desc,None,Some(&mut stage)).map_err(|e|e.to_string())?;
                    self.staging=stage;self.size=(desc.Width,desc.Height);
                }
                let stage=self.staging.as_ref().ok_or("Textura de leitura ausente")?;
                self.context.CopyResource(stage,&texture);
                let mut mapped=D3D11_MAPPED_SUBRESOURCE::default();
                self.context.Map(stage,0,D3D11_MAP_READ,0,Some(&mut mapped)).map_err(|e|e.to_string())?;
                // Downsample on read, keeping aspect ratio and avoiding a full
                // native-resolution copy when the display exceeds 1080p.
                let factor=(1920.0/desc.Width as f64).min(1080.0/desc.Height as f64).min(1.0);
                let width=((desc.Width as f64*factor).round().max(2.0) as usize)&!1;
                let height=((desc.Height as f64*factor).round().max(2.0) as usize)&!1;
                let mut bytes=vec![0u8;16+width*height*3/2];
                bytes[..4].copy_from_slice(&(width as u32).to_le_bytes());
                bytes[4..8].copy_from_slice(&(height as u32).to_le_bytes());
                // NV12 is the native 4:2:0 layout used by video encoders.
                // Transfer 3 MB rather than 8 MB per 1080p frame across IPC.
                for y in (0..height).step_by(2) {
                    for x in (0..width).step_by(2) {
                        let mut sum_r=0i32;let mut sum_g=0i32;let mut sum_b=0i32;
                        for dy in 0..2 {for dx in 0..2 {
                            let sx=(x+dx)*desc.Width as usize/width;let sy=(y+dy)*desc.Height as usize/height;
                            let pixel=(mapped.pData as *const u8).add(sy*mapped.RowPitch as usize+sx*4);
                            let b=*pixel as i32;let g=*pixel.add(1) as i32;let r=*pixel.add(2) as i32;
                            bytes[16+(y+dy)*width+x+dx]=(((66*r+129*g+25*b+128)>>8)+16).clamp(0,255) as u8;
                            sum_r+=r;sum_g+=g;sum_b+=b;
                        }}
                        let r=sum_r/4;let g=sum_g/4;let b=sum_b/4;
                        let uv=16+width*height+(y/2)*width+x;
                        bytes[uv]=(((-38*r-74*g+112*b+128)>>8)+128).clamp(0,255) as u8;
                        bytes[uv+1]=(((112*r-94*g-18*b+128)>>8)+128).clamp(0,255) as u8;
                    }
                }
                self.context.Unmap(stage,0);
                Ok(bytes)
            })();
            let _=self.dup.ReleaseFrame();result
        }}
    }
}

use std::{sync::{Arc,Condvar,Mutex,OnceLock},time::{Duration,Instant}};
struct Latest {bytes:Arc<Vec<u8>>,error:Option<String>,last_request:Instant,active:bool}
struct Service {latest:Mutex<Latest>,changed:Condvar}
static SERVICE:OnceLock<Arc<Service>>=OnceLock::new();
pub fn frame()->Result<Vec<u8>,String>{
    #[cfg(not(windows))] {return Err("Captura nativa disponivel apenas no Windows".into());}
    #[cfg(windows)] {
        let service=SERVICE.get_or_init(||{
            let service=Arc::new(Service{latest:Mutex::new(Latest{bytes:Arc::new(Vec::new()),error:None,last_request:Instant::now(),active:false}),changed:Condvar::new()});
            let worker=service.clone();
            std::thread::spawn(move||{
                let mut capture:Option<platform::Capture>=None;let mut sequence=0u64;
                loop {
                    let mut state=worker.latest.lock().unwrap();
                    while !state.active || state.last_request.elapsed()>Duration::from_millis(500) {
                        capture=None;state.bytes=Arc::new(Vec::new());
                        state=worker.changed.wait(state).unwrap();
                    }
                    drop(state);
                    let result=(||{
                        if capture.is_none(){capture=Some(platform::Capture::new()?);}
                        capture.as_mut().unwrap().frame()
                    })();
                    let mut state=worker.latest.lock().unwrap();
                    match result {
                        Ok(mut bytes) if !bytes.is_empty()=>{
                            sequence+=1;bytes[8..16].copy_from_slice(&sequence.to_le_bytes());
                            state.bytes=Arc::new(bytes);state.error=None;
                        },
                        Ok(_)=>{},
                        Err(error)=>{capture=None;state.active=false;state.bytes=Arc::new(Vec::new());state.error=Some(error);},
                    }
                    worker.changed.notify_all();
                }
            });service
        });
        let mut state=service.latest.lock().map_err(|_|"Capturador indisponivel")?;
        if !state.active {state.active=true;state.error=None;}
        state.last_request=Instant::now();service.changed.notify_all();
        let deadline=Instant::now()+Duration::from_secs(3);
        while state.bytes.is_empty() && state.error.is_none(){
            let remain=deadline.saturating_duration_since(Instant::now());
            if remain.is_zero(){return Err("Captura excedeu o tempo limite".into());}
            state=service.changed.wait_timeout(state,remain).map_err(|_|"Capturador indisponivel")?.0;
        }
        if let Some(error)=&state.error{return Err(error.clone());}
        let frame=state.bytes.clone();drop(state);
        Ok((*frame).clone())
    }
}

#[cfg(test)] mod tests {
    #[test] #[ignore="Requires an unlocked interactive Windows desktop"]
    fn capture_primary_monitor(){
        let started=std::time::Instant::now();let mut frames=0;let mut bytes=0;
        for _ in 0..90 {let frame=super::frame().unwrap();if !frame.is_empty(){assert!(frame.len()>8);frames+=1;bytes+=frame.len();}}
        println!("native capture: {frames} changed frames, {bytes} bytes in {:?}",started.elapsed());
    }
}
