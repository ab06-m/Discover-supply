import { zohoGet } from "@/lib/zoho-api";
import Image from "next/image";
import { ShoppingCart, Heart } from "lucide-react";

export const revalidate = 60; // Revalidate items every 60 seconds

import Pagination from "@/components/Pagination";
import SearchBar from "@/components/SearchBar";

export default async function Home({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  let items: any[] = [];
  let pageContext = { has_more_page: false };
  
  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || "1", 10);
  const limit = parseInt(resolvedParams.limit || "24", 10);
  const search = resolvedParams.search || "";

  try {
    const fetchParams: any = { status: "active", per_page: limit, page };
    if (search) {
      fetchParams.search_text = search;
    }
    
    const res = await zohoGet("/items", fetchParams);
    items = res.items || [];
    pageContext = res.page_context || { has_more_page: false };
  } catch (err) {
    console.error("Failed to fetch products:", err);
  }

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-content animate-fade-in">
            <h1>Premium Distribution for Modern Business</h1>
            <p className="hero-subtitle">Access our catalog of high-quality products directly from our warehouse to your door.</p>
            <div className="hero-actions">
              <button className="btn btn-accent btn-lg">Explore Catalog</button>
              <button className="btn btn-outline btn-lg">Become a Partner</button>
            </div>
          </div>
        </div>
        <div className="hero-glow"></div>
      </section>

      <section className="products-section">
        <div className="container">
          <div className="section-header">
            <h2>Featured Products</h2>
            <p>Our most popular items in stock and ready to ship.</p>
            
            <div className="search-wrapper">
              <SearchBar />
            </div>
          </div>

          <div className="product-grid">
            {items.map((item) => (
              <div key={item.item_id} className="product-card glass">
                <div className="product-image-wrap">
                  {item.image_name ? (
                    <img
                      src={`https://inventory.zoho.com/api/v1/items/${item.item_id}/image?organization_id=${process.env.ZOHO_ORG_ID}`}
                      alt={item.name}
                      className="product-image"
                      loading="lazy"
                    />
                  ) : (
                    <div className="product-image-fallback">
                      <span>No Image</span>
                    </div>
                  )}
                  <button className="fav-btn">
                    <Heart size={18} />
                  </button>
                </div>
                
                <div className="product-info">
                  <div className="product-meta">
                    <span className="product-sku">{item.sku}</span>
                    {item.stock_on_hand > 0 ? (
                      <span className="badge badge-success">In Stock</span>
                    ) : (
                      <span className="badge badge-error">Out of Stock</span>
                    )}
                  </div>
                  
                  <h3 className="product-title">{item.name}</h3>
                  <div className="product-price-row">
                    <span className="product-price">${item.rate.toFixed(2)}</span>
                    <button className="add-cart-btn btn-accent">
                      <ShoppingCart size={16} />
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div className="empty-state">
                <p>No products found or failed to load catalog.</p>
              </div>
            )}
          </div>
          
          <Pagination 
            currentPage={page} 
            perPage={limit} 
            hasMore={pageContext.has_more_page} 
          />
        </div>
      </section>
    </>
  );
}
