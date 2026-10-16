import "server-only";
import { DEFAULT_THEME, parseTheme } from "@/lib/theme";
import { parseRestaurantSettings } from "@/lib/restaurant-settings";
import type { Restaurant } from "@/generated/prisma/client";
import type { RestaurantFormValues } from "@/components/admin/restaurant-form";

export function emptyRestaurantValues(): RestaurantFormValues {
  return {
    name: "",
    cuisineType: "",
    tagline: "",
    description: "",
    practicalInfo: "",
    addressLine1: "",
    addressLine2: "",
    postalCode: "",
    city: "",
    country: "FR",
    phone: "",
    email: "",
    website: "",
    instagram: "",
    facebook: "",
    mapsUrl: "",
    defaultLocale: "fr",
    locales: ["fr", "en", "es", "it", "de"],
    currency: "EUR",
    theme: DEFAULT_THEME,
    settings: parseRestaurantSettings({}),
    logoAssetId: null,
    coverAssetId: null,
    facadeAssetId: null,
    interiorAssetId: null,
    galleryAssetIds: [],
  };
}

export function restaurantToValues(r: Restaurant): RestaurantFormValues {
  return {
    name: r.name,
    cuisineType: r.cuisineType ?? "",
    tagline: r.tagline ?? "",
    description: r.description ?? "",
    practicalInfo: r.practicalInfo ?? "",
    addressLine1: r.addressLine1 ?? "",
    addressLine2: r.addressLine2 ?? "",
    postalCode: r.postalCode ?? "",
    city: r.city ?? "",
    country: r.country,
    phone: r.phone ?? "",
    email: r.email ?? "",
    website: r.website ?? "",
    instagram: r.instagram ?? "",
    facebook: r.facebook ?? "",
    mapsUrl: r.mapsUrl ?? "",
    defaultLocale: r.defaultLocale,
    locales: r.locales,
    currency: r.currency,
    theme: parseTheme(r.theme),
    settings: parseRestaurantSettings(r.settings),
    logoAssetId: r.logoAssetId,
    coverAssetId: r.coverAssetId,
    facadeAssetId: r.facadeAssetId,
    interiorAssetId: r.interiorAssetId,
    galleryAssetIds: r.galleryAssetIds,
  };
}
