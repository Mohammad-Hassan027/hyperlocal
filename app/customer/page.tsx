import { Suspense } from "react";
import CustomerView from "@/components/CustomerView";

export default function CustomerPage() {
  return (
    <Suspense fallback={<p className="py-24 text-center text-lg text-muted">Looking for workers near you…</p>}>
      <CustomerView />
    </Suspense>
  );
}
