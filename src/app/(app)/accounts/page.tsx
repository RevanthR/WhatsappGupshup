import { redirect } from "next/navigation";

// Businesses are listed on the WhatsApp numbers page.
export default function AccountsPage() {
  redirect("/numbers");
}
