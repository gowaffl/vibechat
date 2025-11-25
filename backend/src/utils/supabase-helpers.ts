/**
 * Supabase Query Helpers
 * 
 * Helper functions to simplify common Supabase query patterns
 * and provide better TypeScript support
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Execute a query and throw an error if it fails
 */
export async function executeQuery<T>(
  queryBuilder: Promise<{ data: T | null; error: any }>
): Promise<T> {
  const { data, error } = await queryBuilder;
  
  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }
  
  if (data === null) {
    throw new Error("Query returned null data");
  }
  
  return data;
}

/**
 * Execute a query that may return null without throwing
 */
export async function executeQueryNullable<T>(
  queryBuilder: Promise<{ data: T | null; error: any }>
): Promise<T | null> {
  const { data, error } = await queryBuilder;
  
  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }
  
  return data;
}

/**
 * Format timestamp to ISO string, handling both string and Date types
 */
export function formatTimestamp(timestamp: string | Date | null | undefined): string | null {
  if (!timestamp) return null;
  if (typeof timestamp === 'string') return timestamp;
  return new Date(timestamp).toISOString();
}

/**
 * Build a dynamic update object, filtering out undefined values
 */
export function buildUpdateObject(updates: Record<string, any>): Record<string, any> {
  return Object.entries(updates).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>);
}

/**
 * Fetch related data using multiple queries (simulates Prisma's include)
 * 
 * @example
 * const message = await fetchWithRelations(db, 'message', messageId, {
 *   user: { table: 'user', foreignKey: 'userId' },
 *   replyTo: { table: 'message', foreignKey: 'replyToId' }
 * });
 */
export async function fetchWithRelations(
  db: SupabaseClient,
  tableName: string,
  id: string,
  relations: Record<string, { table: string; foreignKey: string; include?: any }>
): Promise<any> {
  // Fetch the main record
  const { data: mainRecord, error: mainError } = await db
    .from(tableName)
    .select("*")
    .eq("id", id)
    .single();

  if (mainError || !mainRecord) {
    throw new Error(`Failed to fetch ${tableName} with id ${id}: ${mainError?.message}`);
  }

  // Fetch related records
  for (const [relationName, config] of Object.entries(relations)) {
    const foreignKeyValue = mainRecord[config.foreignKey];
    
    if (foreignKeyValue) {
      const { data: relatedData } = await db
        .from(config.table)
        .select("*")
        .eq("id", foreignKeyValue)
        .single();

      mainRecord[relationName] = relatedData;
      
      // Handle nested includes
      if (config.include && relatedData) {
        for (const [nestedRelationName, nestedConfig] of Object.entries(config.include)) {
          const nestedForeignKeyValue = relatedData[nestedConfig.foreignKey];
          
          if (nestedForeignKeyValue) {
            const { data: nestedData } = await db
              .from(nestedConfig.table)
              .select("*")
              .eq("id", nestedForeignKeyValue)
              .single();

            relatedData[nestedRelationName] = nestedData;
          }
        }
      }
    } else {
      mainRecord[relationName] = null;
    }
  }

  return mainRecord;
}

