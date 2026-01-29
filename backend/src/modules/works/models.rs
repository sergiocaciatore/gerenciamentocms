use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddressModel {
    pub street: String,
    pub neighborhood: String,
    pub city: String,
    pub state: String,
    pub number: String,
    pub complement: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Evaluation {
    pub technical: i32,
    pub management: i32,
    pub leadership: i32,
    pub organization: i32,
    pub commitment: i32,
    pub communication: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResidentAssignment {
    pub id: String,
    pub name: String,
    pub contract_start: String,
    pub contract_end: String,
    pub evaluation: Option<Evaluation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Work {
    pub id: String,
    pub regional: String,
    pub go_live_date: String,
    pub cep: String,
    pub address: AddressModel,
    pub work_type: String, // 'type' é reservado em Rust
    pub cnpj: String,
    pub business_case: String,
    pub capex_approved: String,
    pub internal_order: String,
    pub oi: Option<String>,
    #[serde(default)] // Array vazio se não vier no JSON
    pub residents: Vec<ResidentAssignment>,
    
    // Campos calculados/flags (opcionais na criação, mas presentes na leitura)
    #[serde(default)]
    pub has_engineering: bool,
    #[serde(default)]
    pub has_planning: bool,
    #[serde(default)]
    pub has_report: bool,
    #[serde(default)]
    pub has_control_tower: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkCreate {
    pub id: String,
    pub regional: String,
    pub go_live_date: String,
    pub cep: String,
    pub address: AddressModel,
    pub work_type: String,
    pub cnpj: String,
    pub business_case: String,
    pub capex_approved: String,
    pub internal_order: String,
    pub oi: Option<String>,
    #[serde(default)]
    pub residents: Vec<ResidentAssignment>,
}
