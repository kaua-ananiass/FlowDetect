// LAN pairing and authenticated transport shared by FlowDetect Studio and Agent.
// No Internet relay. Only same-subnet discovery; do not port-forward either port.
use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::HashMap, fs, net::{IpAddr, Ipv4Addr, UdpSocket}, path::{Path, PathBuf}, sync::{Mutex, OnceLock}, thread, time::{Duration, SystemTime, UNIX_EPOCH}};

pub const PROTOCOL: u64 = 1;
fn device_id(dir:&Path)->Result<String,String>{
    let f=dir.join("flowdetect_agent_device_id.txt");
    if let Ok(existing)=fs::read_to_string(&f){
        let id=existing.trim();if id.len()==32&&unhex(id).is_ok(){return Ok(id.to_string());}
    }
    fs::create_dir_all(dir).map_err(|e|e.to_string())?;
    let id=hex(&random_bytes::<16>()?);
    fs::write(f,&id).map_err(|e|format!("Falha ao salvar ID do Agent: {e}"))?;
    Ok(id)
}
const CODE_LIFETIME: u64 = 600;
const PORT_DISCOVERY: u16 = 18453;
const DISCOVERY_REQUEST: &[u8] = b"FLOWDETECT_DISCOVER_V1";
const MAX_DISCOVERY: usize = 32;
const ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

fn now() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() }
fn random_bytes<const N: usize>() -> Result<[u8; N], String> {
    let mut out = [0u8; N];
    getrandom::getrandom(&mut out).map_err(|_| "Sem gerador criptografico de aleatoriedade".to_string())?;
    Ok(out)
}
fn hex(bytes: &[u8]) -> String { bytes.iter().map(|x| format!("{x:02x}")).collect() }
fn unhex(s: &str) -> Result<Vec<u8>, String> {
    if s.len()%2!=0 || s.len()>256 { return Err("Codigo hexadecimal invalido".into()); }
    (0..s.len()).step_by(2).map(|i| u8::from_str_radix(&s[i..i+2],16).map_err(|_| "Codigo hexadecimal invalido".to_string())).collect()
}
fn hash(data: impl AsRef<[u8]>) -> [u8;32] {
    let mut h=Sha256::new(); h.update(data);h.finalize().into()
}
fn hmac(key:&[u8],data:&[u8]) -> [u8;32] {
    let mut k=[0u8;64];if key.len()>64{k[..32].copy_from_slice(&hash(key));}else{k[..key.len()].copy_from_slice(key);}
    let mut inner=[0x36;64];let mut outer=[0x5c;64];
    for i in 0..64{inner[i]^=k[i];outer[i]^=k[i];}
    let mut h=Sha256::new();h.update(inner);h.update(data);let x=h.finalize();
    let mut h=Sha256::new();h.update(outer);h.update(x);h.finalize().into()
}
fn equal(a:&[u8],b:&[u8])->bool{if a.len()!=b.len(){return false;}let mut n=0u8;for (x,y) in a.iter().zip(b){n|=x^y;}n==0}
fn normalized(code:&str)->String{code.chars().filter(|c|c.is_ascii_alphanumeric()).map(|c|c.to_ascii_uppercase()).collect()}
fn fresh_code() -> Result<String,String> {
    let b=random_bytes::<12>()?;
    let s:String=b.iter().map(|x|ALPHABET[(*x as usize)%ALPHABET.len()] as char).collect();
    Ok(format!("{}-{}-{}",&s[..4],&s[4..8],&s[8..12]))
}
fn cipher_encrypt(key:&[u8],data:&[u8])->Result<Value,String>{
    let iv=random_bytes::<12>()?;
    let c=Aes256Gcm::new_from_slice(key).map_err(|_|"Chave invalida".to_string())?;
    let encoded=c.encrypt(Nonce::from_slice(&iv),data).map_err(|_|"Falha na criptografia".to_string())?;
    Ok(json!({"iv":hex(&iv),"sealed":B64.encode(encoded),"v":PROTOCOL}))
}
fn cipher_decrypt(key:&[u8],wrapper:&Value)->Result<Vec<u8>,String>{
    let iv=unhex(wrapper.get("iv").and_then(Value::as_str).unwrap_or(""))?;
    if iv.len()!=12 {return Err("Nonce invalido".into());}
    let data=B64.decode(wrapper.get("sealed").and_then(Value::as_str).unwrap_or("")).map_err(|_|"Envelope invalido".to_string())?;
    let c=Aes256Gcm::new_from_slice(key).map_err(|_|"Chave invalida".to_string())?;
    c.decrypt(Nonce::from_slice(&iv),data.as_slice()).map_err(|_|"Falha de autenticacao do conteudo".to_string())
}
fn code_key(code:&str,challenge:&str)->[u8;32]{
    hash(format!("FlowDetect code pairing v1:{}:{}",normalized(code),challenge))
}
#[derive(Clone)]
struct PairingCode{code:String,expires:u64,attempts:u8,locked_until:u64,challenges:HashMap<String,u64>}
static PAIR_CODE:OnceLock<Mutex<PairingCode>>=OnceLock::new();
fn code_state()->Result<&'static Mutex<PairingCode>,String>{
    if let Some(c)=PAIR_CODE.get(){return Ok(c);}
    let _=PAIR_CODE.set(Mutex::new(PairingCode{code:fresh_code()?,expires:now()+CODE_LIFETIME,attempts:0,locked_until:0,challenges:HashMap::new()}));
    PAIR_CODE.get().ok_or("Falha ao criar codigo".into())
}
fn ensure_fresh(st:&mut PairingCode)->Result<(),String>{
    if st.expires<=now(){st.code=fresh_code()?;st.expires=now()+CODE_LIFETIME;st.attempts=0;st.locked_until=0;st.challenges.clear();}
    Ok(())
}
pub fn local_status()->Result<Value,String>{
    let mut st=code_state()?.lock().map_err(|_|"Estado do pareamento indisponivel".to_string())?;
    ensure_fresh(&mut st)?;
    Ok(json!({"code":st.code,"expires_at":st.expires,"pairing_protocol":PROTOCOL,"discovery_port":PORT_DISCOVERY}))
}
pub fn renew_code()->Result<Value,String>{
    let mut st=code_state()?.lock().map_err(|_|"Estado indisponivel".to_string())?;
    st.expires=0;ensure_fresh(&mut st)?;Ok(json!({"code":st.code,"expires_at":st.expires,"pairing_protocol":PROTOCOL}))
}
pub fn challenge()->Result<Value,String>{
    let mut st=code_state()?.lock().map_err(|_|"Estado indisponivel".to_string())?;ensure_fresh(&mut st)?;
    st.challenges.retain(|_,expires|*expires>now());
    if st.challenges.len()>64{return Err("Muitas tentativas de pareamento; tente novamente".into());}
    let nonce=hex(&random_bytes::<16>()?);st.challenges.insert(nonce.clone(),now()+90);
    Ok(json!({"challenge":nonce,"pairing_protocol":PROTOCOL,"expires_in":90}))
}
#[derive(Serialize,Deserialize,Clone)]
struct AgentClient{id:String,name:String,key:String,created_at:u64}
fn agent_clients(root:&Path)->Result<Vec<AgentClient>,String>{
    let file=root.join("flowdetect_agent_pairings_v1.dat");
    if !file.exists(){return Ok(Vec::new());}
    serde_json::from_slice(&secure_read(&file)?).map_err(|e|format!("Pareamentos corrompidos: {e}"))
}
fn save_agent_clients(root:&Path,clients:&[AgentClient])->Result<(),String>{
    secure_write(&root.join("flowdetect_agent_pairings_v1.dat"),&serde_json::to_vec_pretty(clients).map_err(|e|e.to_string())?).map_err(|e|format!("Falha ao salvar pareamento: {e}"))
}
pub fn complete(root:&Path,payload:&Value)->Result<Value,String>{
    let challenge=payload.get("challenge").and_then(Value::as_str).unwrap_or("");
    let proof=payload.get("proof").and_then(Value::as_str).unwrap_or("");
    let name=payload.get("name").and_then(Value::as_str).unwrap_or("FlowDetect Studio");
    let mut st=code_state()?.lock().map_err(|_|"Estado indisponivel".to_string())?;
    ensure_fresh(&mut st)?;
    if now()<st.locked_until{return Err("Tentativas bloqueadas por 60 segundos".into());}
    let expires=st.challenges.remove(challenge).unwrap_or(0);
    if expires<=now(){return Err("Desafio expirado; tente novamente".into());}
    let expected=hmac(&code_key(&st.code,challenge),format!("pair:{challenge}").as_bytes());
    let given=unhex(proof).unwrap_or_default();
    if !equal(&expected,&given){
        st.attempts=st.attempts.saturating_add(1);
        if st.attempts>=8{st.locked_until=now()+60;st.attempts=0;}
        return Err("Codigo incorreto ou expirado".into());
    }
    let wrapping_key=code_key(&st.code,challenge);
    let id=hex(&random_bytes::<8>()?);
    let session_key=random_bytes::<32>()?;
    let mut clients=agent_clients(root)?;
    clients.push(AgentClient{id:id.clone(),name:name.chars().take(80).collect(),key:hex(&session_key),created_at:now()});
    if clients.len()>64{clients.remove(0);}
    save_agent_clients(root,&clients)?;
    st.expires=0;ensure_fresh(&mut st)?;
    cipher_encrypt(&wrapping_key,json!({"id":id,"key":hex(&session_key),"protocol":PROTOCOL,"agent_id":device_id(root)?}).to_string().as_bytes())
}
pub fn local_client_count(root:&Path)->usize{agent_clients(root).map(|c|c.len()).unwrap_or(0)}
fn permitted(ip:IpAddr)->bool {
    match ip{IpAddr::V4(v)=>v.is_private()||v.is_loopback()||v.is_link_local(),IpAddr::V6(v)=>v.is_loopback()||v.is_unique_local()||v.is_unicast_link_local()}
}
pub fn serve_discovery(credentials_dir:PathBuf,name:String,version:String){
    thread::spawn(move||{
        let Ok(socket)=UdpSocket::bind(("0.0.0.0",PORT_DISCOVERY)) else {eprintln!("FlowDetect: falha ao abrir descoberta UDP");return};
        let mut buf=[0u8;128];
        loop {
            if let Ok((size,peer))=socket.recv_from(&mut buf){
                if size==DISCOVERY_REQUEST.len() && &buf[..size]==DISCOVERY_REQUEST && permitted(peer.ip()){
                    let out=json!({"type":"flowdetect-agent","protocol":PROTOCOL,"name":name,"version":version,"agent_id":device_id(&credentials_dir).unwrap_or_default()});
                    let _=socket.send_to(out.to_string().as_bytes(),peer);
                }
            }
        }
    });
}

#[derive(Clone,Serialize,Deserialize)]
struct StudioClient{id:String,key:String,name:String,protocol:u64,#[serde(default)] agent_id:String}
static CLIENT_FILE:OnceLock<PathBuf>=OnceLock::new();
static STUDIO_CLIENTS:OnceLock<Mutex<HashMap<String,StudioClient>>>=OnceLock::new();
static SEEN_REQUESTS:OnceLock<Mutex<HashMap<String,u64>>>=OnceLock::new();

pub fn configure_studio_store(path:PathBuf){let _=CLIENT_FILE.set(path);}
fn studio_clients()->&'static Mutex<HashMap<String,StudioClient>>{
    STUDIO_CLIENTS.get_or_init(||{
        let content=CLIENT_FILE.get().and_then(|p|secure_read(p).ok());
        let map=content.and_then(|b|serde_json::from_slice::<HashMap<String,StudioClient>>(&b).ok()).unwrap_or_default();
        Mutex::new(map)
    })
}
fn save_studio_clients(clients:&HashMap<String,StudioClient>)->Result<(),String>{
    let path=CLIENT_FILE.get().ok_or("Diretorio seguro do Studio indisponivel".to_string())?;
    if let Some(parent)=path.parent(){fs::create_dir_all(parent).map_err(|e|e.to_string())?;}
    let data=serde_json::to_vec_pretty(clients).map_err(|e|e.to_string())?;
    secure_write(path,&data)
}
pub fn has_studio_key(address:&str)->bool {
    studio_clients().lock().map(|c|c.contains_key(address)).unwrap_or(false)
}
pub fn authenticated_request(address:&str,method:&str,path:&str,body:&[u8])->Result<Option<(String,Vec<u8>,[u8;32])>,String>{
    let saved=studio_clients().lock().map_err(|_|"Credenciais indisponiveis".to_string())?.get(address).cloned();
    let Some(saved)=saved else {return Ok(None)};
    let key_data=unhex(&saved.key)?;
    let key:[u8;32]=key_data.try_into().map_err(|_|"Chave de Agent invalida".to_string())?;
    let payload=cipher_encrypt(&key,body)?.to_string().into_bytes();
    let stamp=now().to_string();
    let nonce=hex(&random_bytes::<16>()?);
    let signature=hex(&request_signature(&key,method,path,&stamp,&nonce,&payload));
    let headers=format!("X-FlowDetect-Client: {}\r\nX-FlowDetect-Time: {}\r\nX-FlowDetect-Nonce: {}\r\nX-FlowDetect-Proof: {}\r\n",saved.id,stamp,nonce,signature);
    Ok(Some((headers,payload,key)))
}
fn request_signature(key:&[u8],method:&str,path:&str,stamp:&str,nonce:&str,payload:&[u8])->[u8;32]{
    hmac(key,format!("{method}\n{path}\n{stamp}\n{nonce}\n{}",hex(&hash(payload))).as_bytes())
}
fn header<'a>(request:&'a str,key:&str)->Option<&'a str>{
    request.lines().filter_map(|l|l.split_once(':')).find(|(k,_)|k.trim().eq_ignore_ascii_case(key)).map(|(_,v)|v.trim())
}
pub fn authorize(root:&Path,request:&str,method:&str,path:&str,payload:&[u8])->Result<(Vec<u8>,[u8;32]),String>{
    let id=header(request,"X-FlowDetect-Client").ok_or("Pareamento necessario. Informe o codigo exibido no Agent".to_string())?;
    let stamp=header(request,"X-FlowDetect-Time").ok_or("Requisicao nao autenticada".to_string())?;
    let nonce=header(request,"X-FlowDetect-Nonce").ok_or("Requisicao nao autenticada".to_string())?;
    let proof=header(request,"X-FlowDetect-Proof").ok_or("Requisicao nao autenticada".to_string())?;
    let time=stamp.parse::<u64>().map_err(|_|"Data da autenticacao invalida".to_string())?;
    if now().abs_diff(time)>120{return Err("Horario de autenticacao fora da janela; sincronize os relogios dos computadores".into());}
    if nonce.len()!=32||unhex(nonce).is_err(){return Err("Identificador de requisicao invalido".into());}
    let clients=agent_clients(root)?;
    let client=clients.iter().find(|c|c.id==id).ok_or("Studio nao autorizado neste Agent".to_string())?;
    let keybytes=unhex(&client.key)?;
    let key:[u8;32]=keybytes.try_into().map_err(|_|"Chave armazenada invalida".to_string())?;
    let expected=request_signature(&key,method,path,stamp,nonce,payload);
    if !equal(&expected,&unhex(proof).unwrap_or_default()){return Err("Assinatura invalida".into());}
    let seen=SEEN_REQUESTS.get_or_init(||Mutex::new(HashMap::new()));
    let mut guard=seen.lock().map_err(|_|"Protecao contra repeticao indisponivel".to_string())?;
    guard.retain(|_,t|now().saturating_sub(*t)<150);
    if guard.len()>20000{return Err("Protecao de repeticao saturada".into());}
    if guard.insert(format!("{id}:{nonce}"),now()).is_some(){return Err("Requisicao duplicada bloqueada".into());}
    let envelope:Value=serde_json::from_slice(payload).map_err(|_|"Envelope de requisicao invalido".to_string())?;
    Ok((cipher_decrypt(&key,&envelope)?,key))
}
pub fn encrypted_http_response(raw:&[u8],key:&[u8;32])->Vec<u8>{
    let Some(position)=raw.windows(4).position(|x|x==b"\r\n\r\n") else {return raw.to_vec()};
    let header=String::from_utf8_lossy(&raw[..position]);
    let first=header.lines().next().unwrap_or("HTTP/1.1 500 Internal Server Error");
    let envelope=match cipher_encrypt(key,&raw[position+4..]){Ok(v)=>v.to_string(),Err(_)=>return b"HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_vec()};
    format!("{first}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",envelope.len(),envelope).into_bytes()
}
pub fn decrypted_remote_result(value:Value,key:&[u8;32])->Result<Value,String>{
    if !value.is_object() || value.get("sealed").is_none(){return Err("Resposta sem criptografia; o Agent e o Studio podem estar em versoes incompatíveis".into());}
    let bytes=cipher_decrypt(key,&value)?;
    serde_json::from_slice(&bytes).map_err(|_|"Resposta do Agent invalida".to_string())
}

#[cfg(windows)]
fn discover_ipv4_interfaces() -> Vec<(Ipv4Addr, Ipv4Addr)> {
    // Enumerate Windows IPv4 addresses with masks without relying on ipconfig
    // output, which changes across languages and Windows versions.
    #[repr(C)]
    struct IpRow {
        addr: u32,
        index: u32,
        mask: u32,
        bcast: u32,
        reassembly_size: u32,
        unused: u16,
        row_type: u16,
    }
    #[repr(C)]
    struct IpTable {
        count: u32,
        rows: [IpRow; 1],
    }
    #[link(name = "iphlpapi")]
    extern "system" {
        fn GetIpAddrTable(table: *mut IpTable, size: *mut u32, sort: i32) -> u32;
    }

    let mut capacity = 0u32;
    // A null buffer is expected to return the required size.
    let _ = unsafe { GetIpAddrTable(std::ptr::null_mut(), &mut capacity, 0) };
    if capacity == 0 || capacity > 262_144 {
        return Vec::new();
    }

    // u64 storage guarantees alignment for Windows' MIB_IPADDRTABLE.
    let mut storage = vec![0u64; (capacity as usize + 7) / 8];
    let mut provided = (storage.len() * std::mem::size_of::<u64>()) as u32;
    let table_ptr = storage.as_mut_ptr() as *mut IpTable;
    if unsafe { GetIpAddrTable(table_ptr, &mut provided, 0) } != 0 {
        return Vec::new();
    }

    let table = unsafe { &*table_ptr };
    let row_offset = table.rows.as_ptr() as usize - storage.as_ptr() as usize;
    let max_rows = (provided as usize).saturating_sub(row_offset) / std::mem::size_of::<IpRow>();
    let count = (table.count as usize).min(max_rows).min(64);
    let rows = unsafe { std::slice::from_raw_parts(table.rows.as_ptr(), count) };
    let mut result = Vec::new();
    for row in rows {
        // DWORD IPv4 values are network-byte-order words; to_ne_bytes gives
        // the wire octets on Windows without endian-dependent arithmetic.
        let ip = Ipv4Addr::from(row.addr.to_ne_bytes());
        let mask = row.mask;
        let prefix = mask.count_ones();
        if !ip.is_private() || !(8..=30).contains(&prefix) {
            continue;
        }
        let broadcast = Ipv4Addr::from((row.addr | !mask).to_ne_bytes());
        if broadcast == ip || broadcast.is_loopback() {
            continue;
        }
        if !result.iter().any(|pair| *pair == (ip, broadcast)) {
            result.push((ip, broadcast));
        }
    }
    result
}

#[cfg(not(windows))]
fn discover_ipv4_interfaces() -> Vec<(Ipv4Addr, Ipv4Addr)> {
    Vec::new()
}

pub fn discover() -> Result<Vec<Value>, String> {
    // The machine can have multiple adapters (Ethernet, Hyper-V, VirtualBox).
    // Windows may send one unbound 255.255.255.255 datagram on a virtual NIC,
    // silently missing the real Agent. Bind each physical/local source IP and
    // send the directed broadcast computed from the actual interface mask.
    let mut sockets: Vec<(UdpSocket, Ipv4Addr)> = Vec::new();
    for (ip, broadcast) in discover_ipv4_interfaces().into_iter().take(16) {
        let Ok(socket) = UdpSocket::bind((ip, 0)) else { continue };
        if socket.set_broadcast(true).is_ok() && socket.set_nonblocking(true).is_ok() {
            let _ = socket.send_to(DISCOVERY_REQUEST, (broadcast, PORT_DISCOVERY));
            sockets.push((socket, broadcast));
        }
    }

    // Portable fallback where enumeration fails or on a non-Windows build.
    if sockets.is_empty() {
        let socket = UdpSocket::bind("0.0.0.0:0")
            .map_err(|e| format!("Não foi possível iniciar a descoberta de Agents: {e}"))?;
        socket.set_broadcast(true).map_err(|e| e.to_string())?;
        socket.set_nonblocking(true).map_err(|e| e.to_string())?;
        let _ = socket.send_to(DISCOVERY_REQUEST, ("255.255.255.255", PORT_DISCOVERY));
        sockets.push((socket, Ipv4Addr::BROADCAST));
    }

    let started = std::time::Instant::now();
    let mut retried = false;
    let mut agents = HashMap::<String, Value>::new();
    let mut bytes = [0u8; 512];

    while started.elapsed() < Duration::from_millis(2400) && agents.len() < MAX_DISCOVERY {
        for (socket, _) in &sockets {
            loop {
                match socket.recv_from(&mut bytes) {
                    Ok((size, peer)) => {
                        if !permitted(peer.ip()) { continue; }
                        let Ok(item) = serde_json::from_slice::<Value>(&bytes[..size]) else { continue };
                        if item.get("type").and_then(Value::as_str) != Some("flowdetect-agent")
                            || item.get("protocol").and_then(Value::as_u64) != Some(PROTOCOL)
                        {
                            continue;
                        }
                        let address = format!("{}:18452", peer.ip());
                        agents.insert(address.clone(), json!({
                            "address": address,
                            "name": item.get("name"),
                            "version": item.get("version"),
                            "agent_id": item.get("agent_id"),
                            "pairing_protocol": PROTOCOL
                        }));
                    }
                    Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => break,
                    Err(_) => break,
                }
            }
        }
        if !retried && started.elapsed() > Duration::from_millis(650) {
            // A second datagram helps with startup timing and UDP packet loss.
            for (socket, broadcast) in &sockets {
                let _ = socket.send_to(DISCOVERY_REQUEST, (*broadcast, PORT_DISCOVERY));
            }
            retried = true;
        }
        thread::sleep(Duration::from_millis(35));
    }

    Ok(agents.into_values().collect())
}

pub fn discover_and_pair(code:&str,studio_name:&str,address_hint:Option<&str>)->Result<Value,String>{
    let code=normalized(code);
    if code.len()!=12 || !code.bytes().all(|c|ALPHABET.contains(&c)){
        return Err("Digite os 12 caracteres do código exibido no Agent, sem trocar letras por números".into());
    }
    let agents=if let Some(hint)=address_hint.filter(|hint|!hint.trim().is_empty()){
        let supplied=hint.trim().strip_prefix("http://").unwrap_or(hint.trim());
        let target=if supplied.contains(':'){supplied.to_string()}else{format!("{supplied}:18452")};
        let addr:std::net::SocketAddr=target.parse().map_err(|_|"Informe um endereço IPv4 local válido na opção avançada".to_string())?;
        if !permitted(addr.ip()) || addr.port()!=18452{
            return Err("O IP avançado precisa ser privado e usar a porta TCP 18452".into());
        }
        vec![json!({"address":target,"name":"FlowDetect Agent","pairing_protocol":PROTOCOL})]
    }else{discover()?};
    if agents.is_empty(){
        return Err("Nenhum FlowDetect Agent localizado por UDP 18453. Verifique a mesma rede privada e as permissões do firewall. Se necessário, abra Configuração avançada e informe o IP local do Agent junto com o código.".into());
    }
    let mut problems=Vec::<String>::new();
    for item in agents.into_iter().take(12){
        let Some(address)=item.get("address").and_then(Value::as_str) else {continue};
        let challenge=match super::remote_agent_request(address,"GET","/api/pair/challenge",None){
            Ok(v)=>v,
            Err(error)=>{
                problems.push(format!("{address}: não foi possível acessar o pareamento TCP 18452 ({error})"));
                continue;
            }
        };
        let Some(nonce)=challenge.get("challenge").and_then(Value::as_str) else {
            problems.push(format!("{address}: resposta de pareamento incompleta; atualize o Agent"));
            continue;
        };
        if challenge.get("pairing_protocol").and_then(Value::as_u64)!=Some(PROTOCOL){
            problems.push(format!("{address}: protocolo de pareamento incompatível; atualize o Agent"));
            continue;
        }
        let key=code_key(&code,nonce);
        let proof=hex(&hmac(&key,format!("pair:{nonce}").as_bytes()));
        let body=json!({"challenge":nonce,"proof":proof,"name":studio_name}).to_string();
        let wrapped=match super::remote_agent_request(address,"POST","/api/pair/complete",Some(body.as_bytes())){
            Ok(v)=>v,
            Err(error)=>{
                problems.push(format!("{address}: código recusado pelo Agent ({error})"));
                continue;
            }
        };
        let data=cipher_decrypt(&key,&wrapped).map_err(|_|format!("{address}: falha na confirmação criptográfica do pareamento"))?;
        let result:Value=serde_json::from_slice(&data).map_err(|_|"Resposta de pareamento inválida".to_string())?;
        let client=StudioClient{
            id:result.get("id").and_then(Value::as_str).unwrap_or("").to_string(),
            key:result.get("key").and_then(Value::as_str).unwrap_or("").to_string(),
            name:item.get("name").and_then(Value::as_str).unwrap_or("Agent físico").to_string(),
            protocol:PROTOCOL,
            agent_id:result.get("agent_id").and_then(Value::as_str).unwrap_or("").to_string(),
        };
        if client.id.len()!=16 || client.key.len()!=64 {
            return Err("O Agent retornou credenciais incompletas; não foi possível concluir o pareamento".into());
        }
        {
            let mut clients=studio_clients().lock().map_err(|_|"Credenciais do Studio indisponíveis".to_string())?;
            clients.insert(address.to_string(),client.clone());
            save_studio_clients(&clients)?;
        }
        return Ok(json!({
            "ok":true,"address":address,"name":item.get("name"),
            "agent_version":item.get("version"),"agent_id":client.agent_id,
            "pairing_protocol":PROTOCOL
        }));
    }
    let diagnostics=problems.into_iter().take(3).collect::<Vec<_>>().join("; ");
    Err(if diagnostics.is_empty(){
        "Nenhum Agent aceitou o código. Verifique a validade e os computadores na mesma rede.".into()
    }else{
        format!("Pareamento não concluído. {diagnostics}. Verifique o código e a rede privada; o firewall deve permitir UDP 18453 e TCP 18452.")
    })
}
#[cfg(test)]
mod tests{
    use super::*;
    #[test]
    fn hmac_is_deterministic(){let a=hmac(b"key",b"abc");assert_eq!(a,hmac(b"key",b"abc"));assert_ne!(a,hmac(b"key",b"abcd"));}
    #[test]
    fn encrypt_roundtrip(){let k=random_bytes::<32>().unwrap();let p=b"Dados da planilha e tela";let e=cipher_encrypt(&k,p).unwrap();assert_eq!(cipher_decrypt(&k,&e).unwrap(),p);}
    #[test]
    fn code_has_entropy_and_hyphens(){let c=fresh_code().unwrap();assert_eq!(normalized(&c).len(),12);assert_eq!(c.matches('-').count(),2);}
}

pub fn peer_allowed(ip:IpAddr)->bool{permitted(ip)}

#[cfg(test)]
mod protocol_security_tests {
    use super::*;
    #[test]
    fn code_pairing_protects_commands_and_replay() {
        let dir=std::env::temp_dir().join(format!("flowdetect-pair-test-{}",hex(&random_bytes::<8>().unwrap())));
        fs::create_dir_all(&dir).unwrap();
        let status=local_status().unwrap();
        let code=status["code"].as_str().unwrap().to_owned();
        let nonce=challenge().unwrap()["challenge"].as_str().unwrap().to_owned();
        let derived=code_key(&code,&nonce);
        let proof=hex(&hmac(&derived,format!("pair:{nonce}").as_bytes()));
        assert!(complete(&dir,&json!({"challenge":nonce,"proof":"00","name":"Invasor"})).is_err());
        let fresh_nonce=challenge().unwrap()["challenge"].as_str().unwrap().to_owned();
        let secret=code_key(&code,&fresh_nonce);
        let valid=hex(&hmac(&secret,format!("pair:{fresh_nonce}").as_bytes()));
        let accepted=complete(&dir,&json!({"challenge":fresh_nonce,"proof":valid,"name":"Studio testado"})).unwrap();
        let token:Value=serde_json::from_slice(&cipher_decrypt(&secret,&accepted).unwrap()).unwrap();
        let id=token["id"].as_str().unwrap();
        let key=unhex(token["key"].as_str().unwrap()).unwrap();
        let method="POST";let path="/api/control/event";
        let raw=json!({"kind":"key","event":"up","key":"Escape"}).to_string().into_bytes();
        let encrypted=cipher_encrypt(&key,&raw).unwrap().to_string().into_bytes();
        let timestamp=now().to_string();let request_nonce=hex(&random_bytes::<16>().unwrap());
        let signature=hex(&request_signature(&key,method,path,&timestamp,&request_nonce,&encrypted));
        let headers=format!("POST /api/control/event HTTP/1.1\r\nX-FlowDetect-Client: {id}\r\nX-FlowDetect-Time: {timestamp}\r\nX-FlowDetect-Nonce: {request_nonce}\r\nX-FlowDetect-Proof: {signature}\r\n\r\n");
        let (decrypted,session_key)=authorize(&dir,&headers,method,path,&encrypted).unwrap();
        assert_eq!(decrypted,raw);
        assert_eq!(session_key.as_slice(),key.as_slice());
        assert!(authorize(&dir,&headers,method,path,&encrypted).is_err(),"replay blocked");
        assert!(authorize(&dir,"GET /api/status HTTP/1.1\r\n\r\n","GET","/api/status",b"").is_err(),"anonymous blocked");
        let secured=encrypted_http_response(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"ok\":true}",&session_key);
        let body=String::from_utf8_lossy(&secured);let encoded=body.split("\r\n\r\n").nth(1).unwrap();
        let content:Value=serde_json::from_str(encoded).unwrap();
        assert_eq!(decrypted_remote_result(content,&session_key).unwrap()["ok"],true);
        let _=fs::remove_dir_all(dir);
    }
}

pub fn resolve_device(agent_id:&str)->Result<Value,String>{
    let wanted=agent_id.trim();
    if wanted.len()!=32 || unhex(wanted).is_err(){return Err("Identificador de Agent inválido".into());}
    let devices=discover()?;
    let found=devices.into_iter().find(|v|v.get("agent_id").and_then(Value::as_str)==Some(wanted))
        .ok_or("Agent pareado não encontrado nesta rede local. Verifique se está ligado e conectado à mesma rede".to_string())?;
    let new_address=found.get("address").and_then(Value::as_str).unwrap_or("").to_string();
    if new_address.is_empty(){return Err("Endereço de Agent indisponível".into());}
    let mut clients=studio_clients().lock().map_err(|_|"Credenciais indisponíveis".to_string())?;
    let previous=clients.iter().find(|(_,value)|value.agent_id==wanted)
        .map(|(address,entry)|(address.clone(),entry.clone()))
        .ok_or("O Studio ainda não está pareado com este Agent".to_string())?;
    if previous.0!=new_address{
        clients.remove(&previous.0);
        clients.insert(new_address.clone(),previous.1);
        save_studio_clients(&clients)?;
    }
    Ok(json!({"address":new_address,"name":found.get("name"),"agent_version":found.get("version"),"agent_id":wanted,"pairing_protocol":PROTOCOL}))
}

#[cfg(windows)]
#[repr(C)]
struct WindowsDataBlob { size:u32, data:*mut u8 }
#[cfg(windows)]
#[link(name="crypt32")]
extern "system" {
    fn CryptProtectData(input:*const WindowsDataBlob,description:*const u16,entropy:*const WindowsDataBlob,reserved:*const std::ffi::c_void,prompt:*const std::ffi::c_void,flags:u32,output:*mut WindowsDataBlob)->i32;
    fn CryptUnprotectData(input:*const WindowsDataBlob,description:*mut *mut u16,entropy:*const WindowsDataBlob,reserved:*const std::ffi::c_void,prompt:*const std::ffi::c_void,flags:u32,output:*mut WindowsDataBlob)->i32;
}
#[cfg(windows)]
#[link(name="kernel32")]
extern "system" {
    fn LocalFree(mem:*mut std::ffi::c_void)->*mut std::ffi::c_void;
}
#[cfg(windows)]
fn dpapi(data:&[u8],protect:bool)->Result<Vec<u8>,String>{
    let input=WindowsDataBlob{size:data.len().try_into().map_err(|_|"Dados grandes demais".to_string())?,data:data.as_ptr() as *mut u8};
    let mut output=WindowsDataBlob{size:0,data:std::ptr::null_mut()};
    let ok=unsafe {
        if protect {
            CryptProtectData(&input,std::ptr::null(),std::ptr::null(),std::ptr::null(),std::ptr::null(),1,&mut output)
        } else {
            CryptUnprotectData(&input,std::ptr::null_mut(),std::ptr::null(),std::ptr::null(),std::ptr::null(),1,&mut output)
        }
    };
    if ok==0{return Err(format!("Protecao de credenciais do Windows indisponivel: {}",std::io::Error::last_os_error()));}
    let decrypted=if output.data.is_null(){Vec::new()}else{unsafe{std::slice::from_raw_parts(output.data,output.size as usize).to_vec()}};
    unsafe { LocalFree(output.data as *mut std::ffi::c_void); }
    Ok(decrypted)
}
fn secure_write(path:&Path,payload:&[u8])->Result<(),String>{
    #[cfg(windows)]
    let payload={
        let mut data=b"FDP1".to_vec();data.extend_from_slice(&dpapi(&payload,true)?);data
    };
    #[cfg(not(windows))] let payload=payload.to_vec();
    fs::write(path,payload).map_err(|e|e.to_string())
}
fn secure_read(path:&Path)->Result<Vec<u8>,String>{
    let bytes=fs::read(path).map_err(|e|e.to_string())?;
    #[cfg(windows)]
    {
        if !bytes.starts_with(b"FDP1"){return Err("Formato de credenciais inválido; pareie novamente".into());}
        return dpapi(&bytes[4..],false);
    }
    #[cfg(not(windows))]
    { Ok(bytes) }
}
