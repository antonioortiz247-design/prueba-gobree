-- Esquema de Base de Datos para Sistema de Facturación GobreeBelt
-- Fecha: 2026-05-31

-- 1. Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla de Usuarios / Roles (Para auditoría y control de acceso)
CREATE TABLE IF NOT EXISTS public.usuarios_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    rol TEXT CHECK (rol IN ('administrador', 'capturista', 'consulta')) NOT NULL,
    nombre TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabla de Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    rfc TEXT UNIQUE NOT NULL,
    direccion TEXT,
    telefono TEXT,
    email TEXT,
    contacto_principal TEXT,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabla de Facturas
CREATE TABLE IF NOT EXISTS public.facturas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folio TEXT NOT NULL,
    fecha DATE NOT NULL,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    oc TEXT, -- Orden de Compra
    codigo_interno TEXT,
    subtotal DECIMAL(12,2) DEFAULT 0,
    iva DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    observaciones TEXT,
    estatus TEXT CHECK (estatus IN ('pendiente', 'validada', 'archivada')) DEFAULT 'pendiente',
    pdf_url TEXT,
    xml_url TEXT,
    imagen_url TEXT,
    usuario_id TEXT, -- ID del usuario que capturó
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Restricción: No folios duplicados por cliente
    UNIQUE(folio, cliente_id)
);

-- 5. Tabla de Partidas (Detalle de la factura)
CREATE TABLE IF NOT EXISTS public.partidas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    factura_id UUID REFERENCES public.facturas(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    tipo_banda TEXT,
    ancho_mm DECIMAL(10,2),
    longitud_mm DECIMAL(10,2),
    medidas_internas TEXT,
    guia TEXT,
    tipo_union TEXT,
    cantidad DECIMAL(10,2) DEFAULT 1,
    precio_unitario DECIMAL(12,2) DEFAULT 0,
    importe DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Tabla de Auditoría (Audit Logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_email TEXT,
    accion TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    tabla_afectada TEXT NOT NULL,
    registro_id UUID,
    cambios_json JSONB,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Índices de Rendimiento (Optimización para 50k+ registros)
CREATE INDEX IF NOT EXISTS idx_facturas_folio ON public.facturas(folio);
CREATE INDEX IF NOT EXISTS idx_facturas_cliente_id ON public.facturas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON public.facturas(fecha);
CREATE INDEX IF NOT EXISTS idx_facturas_oc ON public.facturas(oc);
CREATE INDEX IF NOT EXISTS idx_facturas_codigo_interno ON public.facturas(codigo_interno);
CREATE INDEX IF NOT EXISTS idx_clientes_rfc ON public.clientes(rfc);
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON public.clientes(nombre);
CREATE INDEX IF NOT EXISTS idx_partidas_ancho ON public.partidas(ancho_mm);
CREATE INDEX IF NOT EXISTS idx_partidas_longitud ON public.partidas(longitud_mm);

-- 8. Full Text Search Index para búsqueda global
-- Creamos una columna generada para búsqueda rápida en observaciones y descripción
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (to_tsvector('spanish', coalesce(folio, '') || ' ' || coalesce(oc, '') || ' ' || coalesce(codigo_interno, '') || ' ' || coalesce(observaciones, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_facturas_fts ON public.facturas USING GIN(fts);

ALTER TABLE public.partidas ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (to_tsvector('spanish', coalesce(descripcion, '') || ' ' || coalesce(tipo_banda, '') || ' ' || coalesce(medidas_internas, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_partidas_fts ON public.partidas USING GIN(fts);
