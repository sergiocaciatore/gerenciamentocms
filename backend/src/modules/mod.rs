use axum::Router;
use crate::AppState;

pub mod auth;
pub mod occurrences;
pub mod plannings;
pub mod works;
pub mod ocs;
pub mod suppliers;
pub mod oc_events;
pub mod managements;
pub mod team;
pub mod events;
pub mod event_definitions;
pub mod project_avoidances;
pub mod lpus;
pub mod backlog;
pub mod residents;

pub fn routes() -> Router<AppState> {
    Router::new()
        .nest("/works", works::routes())
        .nest("/occurrences", occurrences::routes())
        .nest("/plannings", plannings::routes())
        .nest("/ocs", ocs::routes())
        .nest("/suppliers", suppliers::routes())
        .nest("/oc-events", oc_events::routes())
        .nest("/managements", managements::routes())
        .nest("/team", team::routes())
        .nest("/events", events::routes())
        .nest("/event-definitions", event_definitions::routes())
        .nest("/project-avoidances", project_avoidances::routes())
        .nest("/lpus", lpus::routes())
        .nest("/backlog-items", backlog::routes())
        .nest("/residents", residents::routes())
        .nest("/public/supplier", lpus::public_routes())
        .route("/cep/:cep", axum::routing::get(utils::get_cep))
        .merge(auth::routes())
}

pub mod utils;
