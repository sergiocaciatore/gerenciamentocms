export interface EngineeringAddress {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
}

export interface EngineeringWork {
    id: string;
    regional: string;
    work_type: string;
    go_live_date: string;
    type?: string;
    address?: EngineeringAddress;
}

export interface EngineeringScheduleItem {
    name: string;
    start_planned: string;
    start_real: string;
    end_planned: string;
    end_real: string;
}

export interface EngineeringOwnerWork {
    name: string;
    date: string;
    status: string;
}

export interface EngineeringLicense {
    name: string;
    date: string;
    status: string;
}

export interface EngineeringThermometer {
    name: string;
    status: string;
}

export interface EngineeringComplementaryInfo {
    name: string;
    date: string;
    status: string;
}

export interface EngineeringDailyLog {
    day: string;
    text?: string;
    description?: string;
    date?: string;
}

export interface EngineeringGeneralDocs {
    layout: string;
    construtora: string;
    contato: string;
    periodo_obra: string;
    data_inicio: string;
    data_termino: string;
    dias_pendentes: string;
}

export interface EngineeringCapex {
    planned: string;
    approved: string;
    contracted: string;
}

export interface EngineeringHighlights {
    special_attention: string;
    action_plans: string;
    relevant_activities: string;
    observations: string;
}

export interface EngineeringManagement {
    work_id: string;
    regional?: string;
    work_type?: string;

    // People
    operator: string;
    engineer: string;
    coordinator: string;
    control_tower: string;
    pm: string;
    cm: string;

    // Metrics
    size_m2: string;
    floor_size_m2: string;

    // Lists/Objects
    owner_works: EngineeringOwnerWork[];
    licenses: EngineeringLicense[];
    thermometer: EngineeringThermometer[];
    macro_schedule: EngineeringScheduleItem[];
    supply_schedule: EngineeringScheduleItem[];
    complementary_info: EngineeringComplementaryInfo[];
    daily_log: EngineeringDailyLog[];

    general_docs: EngineeringGeneralDocs;
    capex: EngineeringCapex;
    highlights: EngineeringHighlights;

    // Report fields
    presentation_highlights?: string;
    attention_points?: string;
    image_1?: string;
    image_2?: string;
    map_image?: string;
}

export interface EngineeringOccurrence {
    id: string;
    work_id: string;
    date: string;
    description: string;
    type: string;
    status: string;
}

export interface EngineeringTeamMember {
    id: string;
    name: string;
    role: string;
    email: string;
}
