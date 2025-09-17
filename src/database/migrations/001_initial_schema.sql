-- Market Management System - Initial Database Schema
-- This migration creates the core tables for the system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'cashier', 'manager', 'owner');
CREATE TYPE transaction_type AS ENUM ('sale', 'return', 'exchange');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'cancelled', 'refunded');
CREATE TYPE movement_type AS ENUM ('in', 'out', 'adjustment', 'damaged', 'expired');
CREATE TYPE po_status AS ENUM ('draft', 'sent', 'confirmed', 'received', 'cancelled');

-- Users and Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    store_id UUID,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Store/Business Information
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    tax_id VARCHAR(100),
    currency VARCHAR(3) DEFAULT 'TRY',
    timezone VARCHAR(50) DEFAULT 'Europe/Istanbul',
    business_type VARCHAR(100),
    owner_id UUID REFERENCES users(id),
    subscription_plan VARCHAR(50) DEFAULT 'basic',
    subscription_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign key constraint for users.store_id
ALTER TABLE users ADD CONSTRAINT fk_users_store_id FOREIGN KEY (store_id) REFERENCES stores(id);

-- Product Categories
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sku VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(100) UNIQUE,
    category_id UUID REFERENCES categories(id),
    cost_price DECIMAL(12,2) NOT NULL,
    selling_price DECIMAL(12,2) NOT NULL,
    markup_percentage DECIMAL(5,2),
    tax_rate DECIMAL(5,2) DEFAULT 0.00,
    unit_type VARCHAR(50) DEFAULT 'piece',
    weight DECIMAL(8,2),
    dimensions JSONB,
    images TEXT[],
    tags TEXT[],
    is_active BOOLEAN DEFAULT true,
    is_trackable BOOLEAN DEFAULT true,
    reorder_level INTEGER DEFAULT 10,
    reorder_quantity INTEGER DEFAULT 50,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Inventory Management
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,
    quantity_available INTEGER GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
    min_stock_level INTEGER DEFAULT 10,
    max_stock_level INTEGER DEFAULT 1000,
    last_counted_at TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(store_id, product_id)
);

-- Stock Movements (Audit Trail)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    movement_type movement_type NOT NULL,
    quantity INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    reason VARCHAR(255),
    reference_type VARCHAR(50), -- 'purchase', 'sale', 'adjustment', 'return'
    reference_id UUID, -- ID of the related record
    cost_per_unit DECIMAL(12,2),
    total_cost DECIMAL(12,2),
    user_id UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    customer_code VARCHAR(100) UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    date_of_birth DATE,
    gender VARCHAR(20),
    total_purchases DECIMAL(12,2) DEFAULT 0.00,
    total_visits INTEGER DEFAULT 0,
    loyalty_points INTEGER DEFAULT 0,
    customer_since TIMESTAMP DEFAULT NOW(),
    last_purchase_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Sales Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    transaction_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id),
    cashier_id UUID REFERENCES users(id) NOT NULL,
    transaction_type transaction_type DEFAULT 'sale',
    status transaction_status DEFAULT 'pending',
    subtotal DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) DEFAULT 0.00,
    discount_amount DECIMAL(12,2) DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL,
    amount_paid DECIMAL(12,2) DEFAULT 0.00,
    change_amount DECIMAL(12,2) DEFAULT 0.00,
    payment_method VARCHAR(50), -- 'cash', 'card', 'transfer', 'multiple'
    notes TEXT,
    voided_at TIMESTAMP,
    voided_by UUID REFERENCES users(id),
    void_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Transaction Line Items
CREATE TABLE transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    cost_price DECIMAL(12,2) NOT NULL,
    line_total DECIMAL(12,2) NOT NULL,
    discount_amount DECIMAL(12,2) DEFAULT 0.00,
    tax_amount DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    tax_id VARCHAR(100),
    payment_terms VARCHAR(100),
    credit_limit DECIMAL(12,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Purchase Orders
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id),
    po_number VARCHAR(100) UNIQUE NOT NULL,
    status po_status DEFAULT 'draft',
    order_date DATE NOT NULL,
    expected_date DATE,
    received_date DATE,
    subtotal DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Purchase Order Items
CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity_ordered INTEGER NOT NULL,
    quantity_received INTEGER DEFAULT 0,
    unit_cost DECIMAL(12,2) NOT NULL,
    line_total DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Expense Categories
CREATE TABLE expense_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES expense_categories(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Expenses
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    category_id UUID REFERENCES expense_categories(id),
    expense_number VARCHAR(100) UNIQUE,
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    expense_date DATE NOT NULL,
    payment_method VARCHAR(50),
    receipt_url VARCHAR(500),
    vendor VARCHAR(255),
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern VARCHAR(50), -- 'daily', 'weekly', 'monthly', 'yearly'
    tags TEXT[],
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_store_id ON users(store_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);

CREATE INDEX idx_inventory_store_product ON inventory(store_id, product_id);
CREATE INDEX idx_inventory_low_stock ON inventory(store_id, quantity_available) WHERE quantity_available <= min_stock_level;

CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_store ON stock_movements(store_id);
CREATE INDEX idx_stock_movements_date ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);

CREATE INDEX idx_transactions_store_date ON transactions(store_id, created_at);
CREATE INDEX idx_transactions_cashier ON transactions(cashier_id);
CREATE INDEX idx_transactions_customer ON transactions(customer_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_number ON transactions(transaction_number);

CREATE INDEX idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_product ON transaction_items(product_id);

CREATE INDEX idx_customers_store ON customers(store_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);

CREATE INDEX idx_categories_store ON categories(store_id);
CREATE INDEX idx_categories_parent ON categories(parent_id);

CREATE INDEX idx_suppliers_store ON suppliers(store_id);
CREATE INDEX idx_suppliers_active ON suppliers(is_active);

CREATE INDEX idx_purchase_orders_store ON purchase_orders(store_id);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);

CREATE INDEX idx_expenses_store ON expenses(store_id);
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expense_categories_updated_at BEFORE UPDATE ON expense_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
