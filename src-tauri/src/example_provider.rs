use std::collections::BTreeMap;
use std::sync::Arc;

use futures::stream;
use ruxex::provider::auth::{CredentialManager, ProviderAuth};
use ruxex::provider::protocol::{ModelCatalog, ModelInfo, ProviderAccount, ProviderAuthStatus};
use ruxex::provider::{
    ChatRequest, ListModelsRequest, ModelProvider, ModelProviderFactory, ProviderAccountState,
    ProviderAuthEnvironment, ProviderCapabilities, ProviderChatEvent, ProviderConnectionKey,
    ProviderCredentialSnapshot, ProviderDescriptor, ProviderError, ProviderFuture, ProviderInit,
    ProviderModelCatalog, ProviderRequestAuth, ProviderRequestSnapshot, ProviderResult,
    ProviderUsage, UsageRequest,
};
use ruxex_app_server_client::{AppServerRuntime, AppServerRuntimeBuilder};
use ruxex_arg0::Arg0DispatchPaths;

const EXAMPLE_PROVIDER_ID: &str = "example";
const EXAMPLE_CHAT_ANSWER: &str = "これはExample Model Providerの固定応答です。";

#[derive(Clone, Debug)]
struct ExampleProvider {
    credential_manager: Arc<CredentialManager>,
}

#[derive(Debug)]
struct ExampleCredentialSnapshot;

impl ProviderCredentialSnapshot for ExampleCredentialSnapshot {
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

impl ModelProviderFactory for ExampleProvider {
    fn provider_descriptor() -> ProviderDescriptor {
        ProviderDescriptor::new(
            EXAMPLE_PROVIDER_ID,
            ruxex::model_provider::CURRENT_PROVIDER_PROTOCOL_VERSION,
        )
    }

    fn new(init: ProviderInit) -> Self {
        Self {
            credential_manager: init.credential_manager,
        }
    }
}

impl ModelProvider for ExampleProvider {
    fn descriptor(&self) -> ProviderDescriptor {
        Self::provider_descriptor()
    }

    fn request_format(&self) -> ruxex::provider::ProviderRequestFormat {
        ruxex::provider::ProviderRequestFormat::Chat
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            api_key_model_discovery: true,
            web_search: false,
            external_web_access: false,
            namespace_tools: false,
            ..ProviderCapabilities::default()
        }
    }

    fn model_catalog_auth(&self) -> ruxex::provider::ProviderModelCatalogAuth {
        ruxex::provider::ProviderModelCatalogAuth {
            has_api_key_auth: true,
            ..Default::default()
        }
    }

    fn chat(
        &self,
        _request: ChatRequest,
    ) -> ProviderFuture<'_, ProviderResult<ruxex::provider::ProviderChatStream>> {
        Box::pin(async move {
            if !self.is_authenticated() {
                return Err(ProviderError::Unauthenticated);
            }
            Ok(fixed_chat_stream())
        })
    }

    fn list_models(
        &self,
        _request: ListModelsRequest,
    ) -> ProviderFuture<'_, ProviderResult<ProviderModelCatalog>> {
        Box::pin(async {
            Ok(ProviderModelCatalog {
                catalog: ModelCatalog {
                    models: fixed_models(),
                },
                identity: "example:fixed-v1".to_string(),
                etag: Some("example-fixed-v1".to_string()),
            })
        })
    }

    fn auth_state(&self) -> ruxex::provider::ProviderAuthState {
        let authenticated = self.is_authenticated();
        ruxex::provider::ProviderAuthState {
            status: if authenticated {
                ProviderAuthStatus::Authenticated
            } else {
                ProviderAuthStatus::Unauthenticated
            },
            account_id: authenticated.then(|| "example-account".to_string()),
            display_name: authenticated.then(|| "Example User".to_string()),
            managed_auth: false,
            revision: Some(*self.credential_manager.auth_change_receiver().borrow()),
        }
    }

    fn auth_environment(&self) -> ProviderAuthEnvironment {
        ProviderAuthEnvironment {
            host_api_key_env_present: std::env::var_os("RUXEX_API_KEY").is_some(),
            host_api_key_env_enabled: self.credential_manager.api_key_env_enabled(),
            ..ProviderAuthEnvironment::default()
        }
    }

    fn request_snapshot(&self) -> ProviderFuture<'_, ProviderResult<ProviderRequestSnapshot>> {
        Box::pin(async move {
            let revision = Some(*self.credential_manager.auth_change_receiver().borrow());
            Ok(ProviderRequestSnapshot {
                auth: ProviderRequestAuth {
                    authenticated: self.is_authenticated(),
                    managed_auth: false,
                    auth_header_attached: false,
                    auth_header_name: None,
                    revision,
                    owner_generation: None,
                },
                connection_key: ProviderConnectionKey {
                    provider_kind: EXAMPLE_PROVIDER_ID.to_string(),
                    auth_revision: revision,
                },
                credential_snapshot: Arc::new(ExampleCredentialSnapshot),
            })
        })
    }

    fn account_state(&self) -> ProviderResult<ProviderAccountState> {
        let authenticated = self.is_authenticated();
        Ok(ProviderAccountState {
            provider_id: EXAMPLE_PROVIDER_ID.to_string(),
            account: authenticated.then_some(ProviderAccount::ApiKey),
            account_id: authenticated.then(|| "example-account".to_string()),
            display_name: authenticated.then(|| "Example User".to_string()),
            auth_status: if authenticated {
                ProviderAuthStatus::Authenticated
            } else {
                ProviderAuthStatus::Unauthenticated
            },
            usage: None,
        })
    }

    fn login(
        &self,
        mut credentials: BTreeMap<String, String>,
    ) -> ProviderFuture<'_, ProviderResult<()>> {
        let api_key = credentials.remove("api_key");
        Box::pin(async move {
            let api_key = api_key
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| ProviderError::InvalidRequest("api_key is required".to_string()))?;
            self.credential_manager
                .login(ProviderAuth::api_key(api_key.to_string()))
                .await
                .map_err(|error| ProviderError::Provider(error.to_string()))
        })
    }

    fn logout(&self) -> ProviderFuture<'_, ProviderResult<()>> {
        Box::pin(async move {
            self.credential_manager
                .logout()
                .await
                .map(|_| ())
                .map_err(|error| ProviderError::Provider(error.to_string()))
        })
    }

    fn delete(&self) -> ProviderFuture<'_, ProviderResult<bool>> {
        Box::pin(async move {
            self.credential_manager
                .delete()
                .await
                .map_err(|error| ProviderError::Provider(error.to_string()))
        })
    }

    fn usage(&self, _request: UsageRequest) -> ProviderFuture<'_, ProviderResult<ProviderUsage>> {
        Box::pin(async { Ok(ProviderUsage::Unsupported) })
    }
}

impl ExampleProvider {
    fn is_authenticated(&self) -> bool {
        self.credential_manager
            .auth_cached()
            .is_some_and(|auth| auth.api_key().is_some())
    }
}

fn fixed_models() -> Vec<ModelInfo> {
    ["example-model", "example-model-fast"]
        .into_iter()
        .map(ruxex::catalog::model_info_template_from_slug)
        .collect()
}

fn fixed_chat_stream() -> ruxex::provider::ProviderChatStream {
    Box::pin(stream::iter([
        Ok(ProviderChatEvent::Created {
            response_id: Some("example-response".to_string()),
        }),
        Ok(ProviderChatEvent::ServerModel("example-model".to_string())),
        Ok(ProviderChatEvent::OutputTextDelta(
            EXAMPLE_CHAT_ANSWER.to_string(),
        )),
        Ok(ProviderChatEvent::Completed {
            response_id: "example-response".to_string(),
            token_usage: None,
            usage_metadata: None,
            end_turn: Some(true),
        }),
    ]))
}

pub(crate) fn provider_descriptor() -> ProviderDescriptor {
    ExampleProvider::provider_descriptor()
}

fn provider_factory() -> ruxex::cli::ProviderRuntimeFactory {
    fn runtime(init: ProviderInit) -> AppServerRuntime {
        AppServerRuntimeBuilder::build_from_provider_factory::<ExampleProvider>(init)
    }

    (runtime, provider_descriptor())
}

pub async fn run(
    arg0_paths: Arg0DispatchPaths,
    product_identity: ruxex::ProductIdentity,
) -> anyhow::Result<()> {
    let exit = ruxex::cli::run_host_app_server_daemon_with_provider_factory_and_identity(
        arg0_paths,
        Default::default(),
        Default::default(),
        false,
        provider_factory(),
        product_identity,
    )
    .await?;
    if exit == ruxex::app_server::AppServerExit::Forced {
        std::process::exit(0);
    }
    Ok(())
}
