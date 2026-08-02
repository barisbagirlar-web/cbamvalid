import React from "react";
import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { fetchSettings } from "../actions";
import SettingsClient from "./SettingsClient";

export default async function AdminSettingsPage() {
  await requireSuperAdmin();
  const settings = await fetchSettings();

  return <SettingsClient initial={settings} />;
}
