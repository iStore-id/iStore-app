import { supabaseAdmin, isSupabaseAdminConfigured } from "../supabase-admin.js";
import { MediaItem } from "../../types/cms.js";

export class SupabaseMediaRepository {
  private static instance: SupabaseMediaRepository;

  private constructor() {}

  public static getInstance(): SupabaseMediaRepository {
    if (!SupabaseMediaRepository.instance) {
      SupabaseMediaRepository.instance = new SupabaseMediaRepository();
    }
    return SupabaseMediaRepository.instance;
  }

  private ensureClient() {
    if (!supabaseAdmin || !isSupabaseAdminConfigured) {
      throw new Error("Supabase Admin is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    }
    return supabaseAdmin;
  }

  async getMediaItem(id: string): Promise<MediaItem | null> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("media_library")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(`Supabase getMediaItem error: ${error.message}`);
    if (!data) return null;

    return this.mapRowToMediaItem(data);
  }

  async listMediaItems(params: { 
    folder?: string; 
    status?: 'active' | 'archived';
    limit?: number;
    offset?: number;
  } = {}): Promise<{ items: MediaItem[]; total: number }> {
    const client = this.ensureClient();
    let query = client.from("media_library").select("*", { count: "exact" });

    if (params.folder) {
      query = query.eq("folder", params.folder);
    }
    if (params.status) {
      query = query.eq("status", params.status);
    } else {
      query = query.eq("status", "active");
    }

    query = query.order("created_at", { ascending: false });

    if (params.limit) {
      query = query.limit(params.limit);
    }
    if (params.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(`Supabase listMediaItems error: ${error.message}`);

    return {
      items: (data || []).map(row => this.mapRowToMediaItem(row)),
      total: count || 0
    };
  }

  async createMediaItem(item: Omit<MediaItem, "id" | "createdAt" | "updatedAt">): Promise<MediaItem> {
    const client = this.ensureClient();
    const { data, error } = await client
      .from("media_library")
      .insert({
        file_name: item.fileName,
        original_name: item.originalName,
        storage_path: item.storagePath,
        cloudinary_public_id: item.cloudinaryPublicId,
        url: item.url,
        mime_type: item.mimeType,
        size: item.size,
        width: item.width,
        height: item.height,
        alt_text: item.altText,
        folder: item.folder || 'general',
        uploaded_by: item.uploadedBy,
        status: item.status || 'active'
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase createMediaItem error: ${error.message}`);
    return this.mapRowToMediaItem(data);
  }

  async updateMediaMetadata(id: string, metadata: { altText?: string; folder?: string }): Promise<void> {
    const client = this.ensureClient();
    const { error } = await client
      .from("media_library")
      .update({
        alt_text: metadata.altText,
        folder: metadata.folder,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) throw new Error(`Supabase updateMediaMetadata error: ${error.message}`);
  }

  async deleteMediaItem(id: string, hardDelete = false): Promise<void> {
    const client = this.ensureClient();
    if (hardDelete) {
      const { error } = await client.from("media_library").delete().eq("id", id);
      if (error) throw new Error(`Supabase deleteMediaItem error: ${error.message}`);
    } else {
      const { error } = await client
        .from("media_library")
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(`Supabase archiveMediaItem error: ${error.message}`);
    }
  }

  private mapRowToMediaItem(row: any): MediaItem {
    return {
      id: row.id,
      fileName: row.file_name,
      originalName: row.original_name,
      storagePath: row.storage_path,
      cloudinaryPublicId: row.cloudinary_public_id,
      url: row.url,
      mimeType: row.mime_type,
      size: Number(row.size),
      width: row.width,
      height: row.height,
      altText: row.alt_text,
      folder: row.folder,
      uploadedBy: row.uploaded_by,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
