use crate::config::Config;
use anyhow::Result;
use openidconnect::{
    ClientId, ClientSecret, EndpointMaybeSet, EndpointNotSet, EndpointSet, IssuerUrl, RedirectUrl,
    core::*, reqwest,
};

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
pub struct WorkspaceClaims {
    pub hd: Option<String>,
}
impl openidconnect::AdditionalClaims for WorkspaceClaims {}

type Tokens = openidconnect::StandardTokenResponse<
    openidconnect::IdTokenFields<
        WorkspaceClaims,
        openidconnect::EmptyExtraTokenFields,
        CoreGenderClaim,
        CoreJweContentEncryptionAlgorithm,
        CoreJwsSigningAlgorithm,
    >,
    CoreTokenType,
>;

pub type Client = openidconnect::Client<
    WorkspaceClaims,
    CoreAuthDisplay,
    CoreGenderClaim,
    CoreJweContentEncryptionAlgorithm,
    CoreJsonWebKey,
    CoreAuthPrompt,
    openidconnect::StandardErrorResponse<CoreErrorResponseType>,
    Tokens,
    CoreTokenIntrospectionResponse,
    CoreRevocableToken,
    CoreRevocationErrorResponse,
    EndpointSet,
    EndpointNotSet,
    EndpointNotSet,
    EndpointNotSet,
    EndpointMaybeSet,
    EndpointMaybeSet,
>;

#[derive(Clone)]
pub struct Oidc {
    pub client: Client,
    pub http: reqwest::Client,
}

impl Oidc {
    pub async fn discover(config: &Config) -> Result<Self> {
        let http = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(std::time::Duration::from_secs(10))
            .build()?;
        let metadata =
            CoreProviderMetadata::discover_async(IssuerUrl::new(config.issuer.clone())?, &http)
                .await?;
        let client = Client::from_provider_metadata(
            metadata,
            ClientId::new(config.client_id.clone()),
            Some(ClientSecret::new(config.client_secret.clone())),
        )
        .set_redirect_uri(RedirectUrl::new(config.redirect_uri())?);
        Ok(Self { client, http })
    }
}
