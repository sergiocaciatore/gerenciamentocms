use firestore::{FirestoreDb, FirestoreResult};
use futures::stream::StreamExt;
use crate::error::AppError;
use super::models::{Work, WorkCreate};

const COLLECTION_NAME: &str = "works";

pub struct WorksRepository;

impl WorksRepository {
    pub async fn create(db: &FirestoreDb, work: WorkCreate) -> Result<WorkCreate, AppError> {
        // Mapeia WorkCreate para o formato do Firestore se necessário
        // Como as structs são compatíveis (Serde), podemos salvar direto
        db.fluent()
            .insert()
            .into(COLLECTION_NAME)
            .document_id(&work.id)
            .object(&work)
            .execute::<()>()
            .await?;
            
        Ok(work)
    }

    pub async fn get(db: &FirestoreDb, id: &str) -> Result<Work, AppError> {
        let obj: Option<Work> = db.fluent()
            .select()
            .by_id_in(COLLECTION_NAME)
            .obj()
            .one(id)
            .await?;
            
        match obj {
            Some(work) => Ok(work),
            None => Err(AppError::NotFound(format!("Obra não encontrada: {}", id))),
        }
    }

    pub async fn update(db: &FirestoreDb, id: &str, work: WorkCreate) -> Result<WorkCreate, AppError> {
        db.fluent()
            .update()
            .in_col(COLLECTION_NAME)
            .document_id(id)
            .object(&work)
            .execute::<()>()
            .await?;
        Ok(work)
    }

    pub async fn list(db: &FirestoreDb, limit: usize, offset: usize, regional: Option<String>) -> Result<Vec<Work>, AppError> {
        let mut query = db.fluent()
            .select()
            .from(COLLECTION_NAME);
            
        if let Some(reg) = regional {
            query = query.filter(|q| q.field("regional").eq(reg.clone()));
        }
        
        // Firestore não suporta offset eficiente natively para grandes volumes sem cursores,
        // mas a crate suporta .offset() básico para queries pequenas.
        // TODO: Implementar paginação real baseada em cursor para melhor performance
        
        let stream = query
            .limit(limit as u32)
            .offset(offset as u32)
            .obj::<Work>() // Auto-deserializa para struct Work
            .stream_query_with_errors()
            .await?;

        // Coletar stream e tratar erros
        let mut works = Vec::new();
        // precisamos fazer pin no stream ou iterar
         let works_result: Vec<FirestoreResult<Work>> = stream.collect().await;
         
         for res in works_result {
             match res {
                 Ok(work) => works.push(work),
                 Err(e) => tracing::error!("Erro ao deserializar obra: {:?}", e),
             }
         }

        Ok(works)
    }
    
    pub async fn delete(db: &FirestoreDb, id: &str) -> Result<(), AppError> {
        // 1. Deletar Obra
        db.fluent()
            .delete()
            .from(COLLECTION_NAME)
            .document_id(id)
            .execute()
            .await?;
            
        // 2. Deletar Planejamento Vinculado (ID == work_id)
        // Ignoramos erro caso não exista
        let _ = db.fluent()
            .delete()
            .from("plannings")
            .document_id(id)
            .execute()
            .await;
            
        // 3. Deletar Gerenciamento Vinculado (ID == work_id)
        let _ = db.fluent()
            .delete()
            .from("managements")
            .document_id(id)
            .execute()
            .await;
            
        // 4. TODO: Deletar OCs e Occurrences (1:N)
        // Requer query por work_id e iteração.
        // Implementar se necessário consistência estrita imediata.
            
        Ok(())
    }
}
