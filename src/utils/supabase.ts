import { createClient } from '@supabase/supabase-js';
import { config } from '../config/config';
import { logger } from '../lib/logger';
import { HttpException } from '../errors/HttpException';

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_KEY);

export const getPresignedUrl = async (
    fileName: string, 
    contentType: string, 
    size: number
) => {
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const ALLOWED_TYPES = ['application/pdf', 'application/epub+zip'];
    
    // Validate file parameters
    if (size > MAX_FILE_SIZE) {
        throw new HttpException(
            'File size exceeds maximum allowed (50MB)', 
            400
        );
    }
    
    if (!ALLOWED_TYPES.includes(contentType)) {
        throw new HttpException(
            'Invalid file type. Only PDF and EPUB are allowed', 
            400
        );
    }
    
    const objectKey = `uploads/${Date.now()}-${fileName}`;
    
    try {
        const { data, error } = await supabase.storage
            .from(config.SUPABASE_BUCKET)
            .createSignedUploadUrl(objectKey);

        if (error) throw error;
        
        return {
            uploadUrl: data.signedUrl,
            objectKey
        };
    } catch (error) {
        logger.error('Supabase upload URL generation failed', error);
        throw new HttpException('Failed to generate upload URL', 500);
    }
};

export const getSignedUrl = (objectKey: string, expiresIn = 3600) => {
    try {
        const { data } = supabase.storage
            .from(config.SUPABASE_BUCKET)
            .getPublicUrl(objectKey, {
                download: false
            });

        return data.publicUrl;
    } catch (error) {
        logger.error('Failed to generate signed URL', error);
        throw new HttpException('Failed to generate access URL', 500);
    }
};

export const getDownloadUrl = (objectKey: string, fileName: string) => {
    try {
        return supabase.storage
            .from(config.SUPABASE_BUCKET)
            .createSignedUrl(objectKey, 3600, {
                download: fileName
            });
    } catch (error) {
        logger.error('Failed to generate download URL', error);
        throw new HttpException('Failed to generate download URL', 500);
    }
};