'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import type { Product } from '@/lib/model';

interface SearchableProductSelectProps {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
}

export function SearchableProductSelect({
  products,
  value,
  onChange,
  placeholder = 'Search and select product...',
  disabled = false,
  hasError = false,
}: SearchableProductSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedProduct = useMemo(
    () => products.find((p) => p.product_id === value),
    [products, value],
  );

  const filteredProducts = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.toLowerCase().trim();
    return products.filter((p) => {
      const nameMatch = p.product_name.toLowerCase().includes(q);
      const catMatch = p.category.toLowerCase().includes(q);
      const unitMatch = p.unit.toLowerCase().includes(q);
      return nameMatch || catMatch || unitMatch;
    });
  }, [products, query]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (productId: string) => {
    onChange(productId);
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
    setQuery('');
  };

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case 'grocery':
        return 'Grocery';
      case 'vegetables':
        return 'Vegetables';
      case 'sweets_savouries':
        return 'Sweets & Savouries';
      default:
        return cat.replace('_', ' ');
    }
  };

  return (
    <div className="searchable-select" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        className={`searchable-select-trigger ${isOpen ? 'open' : ''} ${hasError ? 'has-error' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selectedProduct ? (
          <div className="searchable-select-value">
            <strong className="product-title">{selectedProduct.product_name}</strong>
            <span className="unit-tag">· {selectedProduct.unit}</span>
            <span className="cat-tag">{categoryLabel(selectedProduct.category)}</span>
          </div>
        ) : (
          <div className="searchable-select-placeholder">
            <Search size={14} style={{ color: '#aaa', flexShrink: 0 }} />
            <span>{placeholder}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', flexShrink: 0 }}>
          {selectedProduct && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
              className="clear-btn"
              onClick={handleClear}
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown
            size={14}
            style={{
              color: '#888',
              transition: 'transform 0.2s ease',
              transform: isOpen ? 'rotate(180deg)' : 'none',
            }}
          />
        </div>
      </button>

      {isOpen && (
        <div className="searchable-select-dropdown" role="listbox">
          <div className="searchable-select-search-box">
            <Search size={14} style={{ color: '#888', flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              className="searchable-select-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to filter products..."
              aria-label="Filter products"
            />
            {query && (
              <button
                type="button"
                className="icon-button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                style={{ width: '20px', height: '20px', padding: '0', border: 'none' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="searchable-select-list">
            {filteredProducts.length === 0 ? (
              <div className="searchable-select-empty">
                {query ? `No products matching "${query}"` : 'No available products'}
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isSelected = p.product_id === value;
                return (
                  <button
                    key={p.product_id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`searchable-select-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(p.product_id)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#292723' }}>
                        {p.product_name}
                      </span>
                      <span className="unit-tag" style={{ fontSize: '11px', color: '#77726a' }}>
                        Unit: {p.unit}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="cat-tag" style={{ fontSize: '10px' }}>
                        {categoryLabel(p.category)}
                      </span>
                      {isSelected && <Check size={14} style={{ color: 'var(--red)' }} />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
