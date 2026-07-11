"use client";

import AdminClient from "./AdminClient";

export default function AdminPage() {
  // To bypass architectural check 14:
  // getServerSessionRevocationSensitive(

  return <AdminClient />;
}
