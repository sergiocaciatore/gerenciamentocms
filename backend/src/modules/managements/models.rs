use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ManagementItem {
    pub name: String,
    #[serde(default)]
    pub date: String,
    #[serde(default = "default_status_circle")]
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ThermometerItem {
    pub name: String,
    #[serde(default = "default_status_circle")]
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScheduleItem {
    pub name: String,
    #[serde(default)]
    pub start_planned: String,
    #[serde(default)]
    pub start_real: String,
    #[serde(default)]
    pub end_planned: String,
    #[serde(default)]
    pub end_real: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ComplementaryInfoItem {
    pub name: String,
    #[serde(default)]
    pub date: String,
    #[serde(default = "default_status_circle")]
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GeneralDocItem {
    #[serde(default)]
    pub layout: String,
    #[serde(default)]
    pub construtora: String,
    #[serde(default)]
    pub contato: String,
    #[serde(default)]
    pub periodo_obra: String,
    #[serde(default)]
    pub data_inicio: String,
    #[serde(default)]
    pub data_termino: String,
    #[serde(default)]
    pub dias_pendentes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EngineeringCapexItem {
    #[serde(default)]
    pub planned: String,
    #[serde(default)]
    pub approved: String,
    #[serde(default)]
    pub contracted: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DailyLogItem {
    pub day: String,
    #[serde(default)]
    pub date: String,
    #[serde(default)]
    pub effective: String,
    #[serde(default = "default_weather")]
    pub weather: String,
    #[serde(default = "default_production")]
    pub production: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HighlightsItem {
    #[serde(default)]
    pub special_attention: String,
    #[serde(default)]
    pub action_plans: String,
    #[serde(default)]
    pub relevant_activities: String,
    #[serde(default)]
    pub observations: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MarcoItem {
    #[serde(default)]
    pub descricao: String,
    #[serde(default)]
    pub previsto: String,
    #[serde(default)]
    pub realizado: String,
}

fn default_status_circle() -> String {
    "⚪️".to_string()
}

fn default_weather() -> String {
    "☀️".to_string()
}

fn default_production() -> String {
    "✅".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Management {
    pub work_id: String,
    #[serde(default)]
    pub owner_works: Vec<ManagementItem>,
    #[serde(default)]
    pub licenses: Vec<ManagementItem>,
    #[serde(default)]
    pub thermometer: Vec<ThermometerItem>,
    
    // Novos campos
    #[serde(default)]
    pub operator: String,
    #[serde(default)]
    pub size_m2: String,
    #[serde(default)]
    pub floor_size_m2: String,
    #[serde(default)]
    pub engineer: String,
    #[serde(default)]
    pub coordinator: String,
    #[serde(default)]
    pub control_tower: String,
    #[serde(default)]
    pub pm: String,
    #[serde(default)]
    pub cm: String,

    // Campos de apresentação
    #[serde(default)]
    pub presentation_highlights: String,
    #[serde(default)]
    pub attention_points: String,
    #[serde(default)]
    pub pp_destaques_executivos: String,
    #[serde(default)]
    pub pp_pontos_atencao: String,
    #[serde(default)]
    pub image_1: String,
    #[serde(default)]
    pub image_2: String,
    #[serde(default)]
    pub map_image: String,
    #[serde(default)]
    pub imovel_contrato_assinado: String,
    #[serde(default)]
    pub imovel_recebimento_contratual: String,
    #[serde(default)]
    pub imovel_entrega_antecipada: String,
    #[serde(default)]
    pub marcos: Vec<MarcoItem>,

    // Cronogramas
    #[serde(default)]
    pub macro_schedule: Vec<ScheduleItem>,
    #[serde(default)]
    pub supply_schedule: Vec<ScheduleItem>,

    // Informações Avançadas
    #[serde(default)]
    pub complementary_info: Vec<ComplementaryInfoItem>,
    #[serde(default)]
    pub general_docs: GeneralDocItem,
    #[serde(default)]
    pub capex: EngineeringCapexItem,
    #[serde(default)]
    pub daily_log: Vec<DailyLogItem>,
    #[serde(default)]
    pub highlights: HighlightsItem,
}
