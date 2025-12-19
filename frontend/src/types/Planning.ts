export interface PlanningStage {
    id?: string;
    name: string;
    // Expected SLA in days
    sla: number;
    // Planned Dates
    start_planned: string | null;
    end_planned: string | null;
    // Real Dates
    start_real: string | null;
    end_real: string | null;
    // Metadata
    responsible: string | null;
    description?: string | null;
    sla_limit?: number | null; // Used in construction schedule sometimes
}

export interface PlanningActionPlan {
    id: string;
    type: 'planning' | 'construction';
    stage_id: string;
    stage_name: string;
    start_date: string;
    sla: number;
    end_date: string;
    description: string;
}

export interface PlanningData {
    schedule: PlanningStage[];
    construction_schedule?: PlanningStage[];
    action_plans?: PlanningActionPlan[];
}

export interface PlanningItem {
    id: string;
    work_id: string;
    status: 'Rascunho' | 'Ativo' | 'Concluído' | 'Arquivado';
    data: PlanningData;
}
