//! Local conversation storage, separate from the inference/session lock.
use serde_json::{json,Value};
use std::{fs,path::Path,sync::Mutex};
static HISTORY:Mutex<()>=Mutex::new(());
const LIMIT:usize=8*1024*1024;
fn read(dir:&Path)->Result<Value,String>{
 let path=dir.join("conversations.dat");if !path.exists(){return Ok(json!({"version":1,"revision":0,"activeId":"","threads":[]}));}
 if fs::metadata(&path).map_err(|_|"Histórico local indisponível.")?.len()>LIMIT as u64+4096{return Err("O histórico local excedeu o tamanho suportado.".into());}
 let data=super::agent_pairing::secure_read(&path)?;
 let value:Value=serde_json::from_slice(&data).map_err(|_|"Não foi possível ler o histórico salvo. O arquivo foi preservado.".to_string())?;
 validate(&value)?;Ok(value)
}
fn validate(value:&Value)->Result<(),String>{
 if value["version"]!=1||!value["revision"].is_u64(){return Err("Versão de histórico não reconhecida. O arquivo foi preservado.".into());}
 let threads=value["threads"].as_array().filter(|v|v.len()<=100).ok_or("O histórico suporta até 100 conversas.")?;
 let mut ids=std::collections::HashSet::new();
 for thread in threads {
  let id=thread["id"].as_str().filter(|s|!s.is_empty()&&s.len()<=80&&s.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'-')).ok_or("Identificador de conversa inválido.")?;
  if !ids.insert(id){return Err("O histórico possui identificadores repetidos.".into());}
  if !thread["title"].as_str().is_some_and(|s|!s.trim().is_empty()&&s.len()<=500)||!thread["messages"].is_array()||!thread["history"].is_array(){return Err("Conversa inválida. O histórico anterior foi preservado.".into());}
  if !matches!(thread["mode"].as_str(),Some("chat"|"generate"|"guide")){return Err("Modo de conversa inválido.".into());}
 }
 let active=value["activeId"].as_str().ok_or("Seleção do histórico inválida.")?;
 if !active.is_empty()&&!ids.contains(active){return Err("A conversa selecionada não existe no histórico.".into());}Ok(())
}
pub fn action(dir:&Path,request:Value)->Result<Value,String>{
 let _guard=HISTORY.lock().map_err(|_|"Histórico local ocupado.".to_string())?;
 let current=read(dir)?;
 if request["action"]=="history_load"{return Ok(current);}
 if request["action"]!="history_save"{return Err("Ação de histórico inválida.".into());}
 let mut data=request["data"].clone();validate(&data)?;
 if data["revision"]!=current["revision"]{return Err("O histórico foi atualizado por outra janela. Reabra o Studio antes de continuar para preservar as conversas.".into());}
 data["revision"]=json!(current["revision"].as_u64().unwrap_or(0)+1);
 let bytes=serde_json::to_vec(&data).map_err(|_|"Não foi possível preparar o histórico.".to_string())?;
 if bytes.len()>LIMIT{return Err("O histórico está cheio. Exclua uma conversa que não precisa mais para salvar as alterações.".into());}
 fs::create_dir_all(dir).map_err(|_|"Não foi possível criar a pasta do histórico.".to_string())?;
 let tmp=dir.join("conversations.tmp");super::agent_pairing::secure_write(&tmp,&bytes)?;
 fs::rename(tmp,dir.join("conversations.dat")).map_err(|_|"Não foi possível salvar o histórico. As conversas anteriores foram preservadas.".to_string())?;
 Ok(json!({"revision":data["revision"]}))
}
#[cfg(test)]mod tests{
 use super::*;
 fn record()->Value{json!({"version":1,"revision":0,"activeId":"chat-a","threads":[{"id":"chat-a","title":"Trabalho A","mode":"chat","messages":[{"role":"user","text":"private-local-message"}],"history":[]}]})}
 #[test]fn stores_encrypted_history_and_rejects_stale_writes(){
  let dir=std::env::temp_dir().join(format!("fd-chat-history-{}",std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
  assert_eq!(action(&dir,json!({"action":"history_load"})).unwrap()["revision"],0);
  assert_eq!(action(&dir,json!({"action":"history_save","data":record()})).unwrap()["revision"],1);
  let loaded=action(&dir,json!({"action":"history_load"})).unwrap();assert_eq!(loaded["threads"][0]["title"],"Trabalho A");
  #[cfg(windows)]assert!(!String::from_utf8_lossy(&fs::read(dir.join("conversations.dat")).unwrap()).contains("private-local-message"));
  assert!(action(&dir,json!({"action":"history_save","data":record()})).is_err());
  let mut next=loaded;next["threads"][0]["title"]=json!("Trabalho atualizado");
  assert_eq!(action(&dir,json!({"action":"history_save","data":next})).unwrap()["revision"],2);
  assert_eq!(action(&dir,json!({"action":"history_load"})).unwrap()["threads"][0]["title"],"Trabalho atualizado");
  fs::remove_file(dir.join("conversations.dat")).unwrap();fs::remove_dir(dir).unwrap();
 }
 #[test]fn rejects_duplicate_ids_and_invalid_active_conversation(){let mut value=record();let duplicate=value["threads"][0].clone();value["threads"].as_array_mut().unwrap().push(duplicate);assert!(validate(&value).is_err());let mut value=record();value["activeId"]=json!("missing");assert!(validate(&value).is_err());}
}
