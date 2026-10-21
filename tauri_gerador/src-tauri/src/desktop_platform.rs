//! OS-specific operations shared by Studio; no shell command interpolation.
use std::{path::Path, process::Command};

fn file_opener(os: &str) -> Result<&'static str, String> {
    match os {
        "windows" => Ok("explorer"),
        "macos" => Ok("/usr/bin/open"),
        "linux" => Ok("xdg-open"),
        _ => Err(format!("Abertura de arquivos indisponivel nesta plataforma: {os}")),
    }
}

pub fn open_path(path: &Path) -> Result<(), String> {
    // Absolute paths also prevent filenames beginning with '-' from becoming options.
    std::fs::metadata(path).map_err(|error| format!("Arquivo ou pasta indisponivel: {error}"))?;
    // Keep the normal Windows/UNC spelling (canonicalize adds a verbatim prefix).
    let absolute = std::path::absolute(path).map_err(|error| format!("Caminho invalido: {error}"))?;
    Command::new(file_opener(std::env::consts::OS)?)
        .arg(absolute)
        .spawn()
        .map_err(|error| format!("Falha ao abrir arquivo ou pasta: {error}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uses_native_file_openers() {
        assert_eq!(file_opener("windows").unwrap(), "explorer");
        assert_eq!(file_opener("macos").unwrap(), "/usr/bin/open");
        assert_eq!(file_opener("linux").unwrap(), "xdg-open");
    }

    #[test]
    fn unsupported_platform_has_no_shell_fallback() {
        assert!(file_opener("ios").is_err());
    }

    #[test]
    fn missing_file_does_not_launch_anything() {
        assert!(open_path(Path::new("__flowdetect_missing_platform_test__/missing")).is_err());
    }
}
