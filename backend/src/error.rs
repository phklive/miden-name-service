use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    BadRequest(String),
    Internal(String),
}

// Human-friendly error messages
impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            AppError::NotFound(msg) => format!("Not Found: {}", msg),
            AppError::BadRequest(msg) => format!("Bad Request: {}", msg),
            AppError::Internal(msg) => format!("Internal Server Error: {}", msg),
        };
        write!(f, "{}", message)
    }
}

// Implement std::error::Error for AppError
impl std::error::Error for AppError {}

// JSON response structure
#[derive(Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    pub status: u16,
}

// Convert AppError to axum Response
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.clone()),
        };

        // Log internal server errors
        if matches!(self, AppError::Internal(_)) {
            log::error!("{}", self);
        }

        let body = Json(ErrorResponse {
            error: error_message,
            status: status.as_u16(),
        });

        (status, body).into_response()
    }
}

// Type alias for results
pub type Result<T> = std::result::Result<T, AppError>;
