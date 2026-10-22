use serde::Serialize;

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum DesktopAppServerErrorKind {
    Lifecycle,
    Initialization,
    Connection,
    Transport,
    Server,
    Decode,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopAppServerError {
    pub(crate) kind: DesktopAppServerErrorKind,
    pub(crate) message: String,
}

pub(crate) type CommandResult<T> = Result<T, DesktopAppServerError>;

pub(crate) fn command_error(
    kind: DesktopAppServerErrorKind,
    message: impl Into<String>,
) -> DesktopAppServerError {
    DesktopAppServerError {
        kind,
        message: message.into(),
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{DesktopAppServerErrorKind, command_error};

    #[test]
    fn app_server_error_categories_are_structured() {
        let errors = [
            command_error(DesktopAppServerErrorKind::Initialization, "bad handshake"),
            command_error(DesktopAppServerErrorKind::Transport, "socket closed"),
            command_error(DesktopAppServerErrorKind::Server, "request rejected"),
        ];
        let kinds = errors
            .into_iter()
            .map(|error| serde_json::to_value(error).unwrap()["kind"].clone())
            .collect::<Vec<_>>();
        assert_eq!(
            kinds,
            [json!("initialization"), json!("transport"), json!("server")]
        );

        let transport_error = command_error(DesktopAppServerErrorKind::Transport, "socket closed");
        assert_eq!(
            serde_json::to_value(transport_error).unwrap(),
            json!({
                "kind": "transport",
                "message": "socket closed",
            })
        );
    }
}
