import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

// Función para crear la configuración de Supabase usando ConfigService
export function createSupabaseConfig(configService: ConfigService) {
  const url = configService.get<string>('SUPABASE_URL');
  const anonKey = configService.get<string>('SUPABASE_ANON_KEY');
  const serviceRoleKey = configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !anonKey) {
    throw new Error('Configuración de Supabase incompleta. Verifica SUPABASE_URL y SUPABASE_ANON_KEY');
  }

  return {
    url,
    anonKey,
    serviceRoleKey,
  };
}

// Configuración temporal para compatibilidad (se usará hasta que se inicialice el ConfigService)
export const supabaseConfig = {
  url: process.env.SUPABASE_URL || '',
  anonKey: process.env.SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};

// Solo crear los clientes si las variables están configuradas
export const supabaseClient = supabaseConfig.url && supabaseConfig.anonKey 
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;

export const supabaseAdminClient = supabaseConfig.url && supabaseConfig.serviceRoleKey
  ? createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey)
  : null; 