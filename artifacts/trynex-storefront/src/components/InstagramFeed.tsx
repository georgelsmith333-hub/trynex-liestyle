import { useState, useEffect } from "react";
import { Instagram, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { useSiteSettings } from "@/context/SiteSettingsContext";

interface InstaPost {
  imageUrl: string;
  link: string;
}

const PLACEHOLDER_FEED: InstaPost[] = [
  { imageUrl: "https://placehold.co/400x400/E85D04/white?text=Follow+Us", link: "#" },
  { imageUrl: "https://placehold.co/400x400/FB8500/white?text=New+Drop", link: "#" },
  { imageUrl: "https://placehold.co/400x400/1C1917/white?text=Custom+Tees", link: "#" },
  { imageUrl: "https://placehold.co/400x400/292524/white?text=Hoodies", link: "#" },
  { imageUrl: "https://placehold.co/400x400/E85D04/white?text=Premium", link: "#" },
  { imageUrl: "https://placehold.co/400x400/FB8500/white?text=Order+Now", link: "#" },
];

export function InstagramFeed() {
  const settings = useSiteSettings();
  const instaHandle = settings.instagramUrl?.replace(/.*instagram\.com\//, "").replace(/\/$/, "") || "trynex.lifestyle";
  const instaUrl = `https://instagram.com/${instaHandle}`;

  return (
    <section className="py-16 px-4 bg-white border-t border-gray-100">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-4"
            style={{ background: "linear-gradient(135deg, rgba(131,58,180,0.1), rgba(253,29,29,0.1))", color: "#E1306C", border: "1px solid rgba(225,48,108,0.15)" }}>
            <Instagram className="w-4 h-4" /> @{instaHandle}
          </span>
          <h2 className="text-3xl md:text-4xl font-black font-display text-gray-900 mt-4">
            Follow Us on Instagram
          </h2>
          <p className="text-gray-500 mt-3">See our latest drops, customer showcases, and behind-the-scenes</p>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
          {PLACEHOLDER_FEED.map((post, i) => (
            <motion.a
              key={i}
              href={instaUrl}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.05 }}
              className="relative aspect-square rounded-2xl overflow-hidden group"
            >
              <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ExternalLink className="w-6 h-6 text-white" />
              </div>
            </motion.a>
          ))}
        </div>

        <div className="text-center mt-8">
          <a
            href={instaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-2xl font-bold text-white text-sm transition-all hover:-translate-y-1"
            style={{ background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)", boxShadow: "0 4px 20px rgba(225,48,108,0.3)" }}
          >
            <Instagram className="w-5 h-5" /> Follow @{instaHandle}
          </a>
        </div>
      </div>
    </section>
  );
}
