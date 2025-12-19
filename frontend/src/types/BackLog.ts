export interface Work {
    id: string;
    regional: string;
    site?: string;
}

export interface BacklogAnnotation {
    date: string;
    description: string;
}

export interface TimelineEvent {
    date: string;
    description: string;
    status: string;
}

export interface BacklogCompletion {
    date: string;
    description: string;
}

export interface BacklogItem {
    id: string;
    work_id: string;
    start_date: string;
    sla: number;
    description: string;
    status: 'Novo' | 'Em Andamento' | 'Concluído';
    has_timeline: boolean;
    annotations: BacklogAnnotation[];
    timeline_events?: TimelineEvent[];
    completion?: BacklogCompletion;
    created_at?: string;
    created_by?: string;
}
