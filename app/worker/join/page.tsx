"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/seed";
import { joinWorker, setMyWorker } from "@/lib/store";
import type { CategoryId } from "@/lib/types";
import { PRESET_LOCATIONS } from "@/lib/geo";

export default function WorkerJoinPage() {
  const [name, setName] = useState("");
  const [selectedCats, setSelectedCats] = useState<CategoryId[]>(["plumber"]);
  const [rate, setRate] = useState(350);
  const [area, setArea] = useState(PRESET_LOCATIONS[0].label || "Thane West");
  const [phone, setPhone] = useState("+91 98201 ");
  const [bio, setBio] = useState("");
  const [mockFileName, setMockFileName] = useState<string | null>(null);
  const [mockPreviewUrl, setMockPreviewUrl] = useState<string | null>(null);

  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const toggleCategory = (catId: CategoryId) => {
    setSelectedCats((prev) =>
      prev.includes(catId)
        ? prev.length > 1
          ? prev.filter((c) => c !== catId)
          : prev
        : [...prev, catId],
    );
  };

  const handleMockUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMockFileName(file.name);
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setMockPreviewUrl(url);
      } else {
        setMockPreviewUrl(null);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selectedCats.length === 0) return;

    const newWorkerId = joinWorker({
      name: name.trim(),
      categories: selectedCats,
      baseRate: rate,
      area,
      bio: bio.trim() || `Experienced in ${selectedCats.join(", ")} work in ${area}.`,
      phone: phone.trim(),
      idDocumentName: mockFileName || "mock_id_card.png",
    });

    setMyWorker(newWorkerId);
    setSubmittedId(newWorkerId);
  };

  if (submittedId) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="flyer p-8 space-y-6 text-center border-2 border-signal shadow-2xl animate-dialog-in">
          <div className="mx-auto size-14 rounded-full bg-signal/15 grid place-items-center text-signal text-3xl font-bold">
            ✓
          </div>
          <div>
            <h1 className="text-3xl font-bold">Application Received</h1>
            <p className="mt-2 text-muted">
              Welcome to the QuickKaam demo network, <b>{name}</b>!
            </p>
          </div>

          <div className="rounded-md border-2 border-dashed border-marigold bg-marigold-soft p-4 space-y-2">
            <span className="inline-block rounded bg-marigold px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-ink">
              Status: ⏳ Pending Verification
            </span>
            <p className="text-sm">
              Your mock ID (<b>{mockFileName || "ID card"}</b>) has been submitted for review.
            </p>
            <p className="text-xs text-muted italic">
              Notice: All verification in this hackathon demo is simulated. Real personal documents are never stored or inspected.
            </p>
          </div>

          <div className="tear-t pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/worker" className="btn btn-go w-full sm:w-auto font-bold min-h-[44px] px-6">
              Go to Worker View
            </Link>
            <Link href="/admin" className="btn btn-line w-full sm:w-auto font-bold min-h-[44px] px-6">
              Open /admin Console
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-6">
      <div className="flyer overflow-hidden shadow-2xl">
        <header className="bg-neel px-6 py-5 text-white">
          <h1 className="text-2xl sm:text-3xl font-display">Join as a Worker</h1>
          <p className="mt-1 text-sm text-white/80">
            Offer your skills in your neighborhood. Start receiving local jobs in minutes.
          </p>
          <div className="mt-2.5 inline-block rounded bg-white/20 px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase">
            Demo Registration
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
          {/* Full Name */}
          <div>
            <label htmlFor="join-name" className="label">
              Full Name *
            </label>
            <input
              id="join-name"
              required
              type="text"
              placeholder="e.g. Anand Shinde"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field"
            />
          </div>

          {/* Select Trades */}
          <div>
            <label className="label">
              Your Trades / Skills (Select at least one) *
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CATEGORIES.map((cat) => {
                const checked = selectedCats.includes(cat.id);
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    className={`flex items-center gap-2 rounded-md border p-2 text-left text-sm font-semibold transition-all ${
                      checked
                        ? "border-ink bg-marigold-soft ring-2 ring-marigold"
                        : "border-ink/20 bg-paper hover:bg-wall"
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Base Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="join-rate" className="label">
                Base Visit Rate (₹) *
              </label>
              <div className="flex items-center gap-1.5">
                <span className="num font-bold text-lg">₹</span>
                <input
                  id="join-rate"
                  type="number"
                  required
                  min={100}
                  max={3000}
                  step={10}
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="field num"
                />
              </div>
            </div>

            <div>
              <label htmlFor="join-area" className="label">
                Operating Area / Neighborhood *
              </label>
              <select
                id="join-area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="field"
              >
                {PRESET_LOCATIONS.map((loc) => (
                  <option key={loc.label} value={loc.label}>
                    {loc.label}
                  </option>
                ))}
                <option value="Kalyan East">Kalyan East</option>
                <option value="Dombivli">Dombivli</option>
                <option value="Mulund">Mulund</option>
              </select>
            </div>
          </div>

          {/* Contact Phone */}
          <div>
            <label htmlFor="join-phone" className="label">
              Mobile Phone (Masked until request accepted)
            </label>
            <input
              id="join-phone"
              type="tel"
              placeholder="+91 98201 12345"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="field font-mono"
            />
            <p className="mt-1 text-xs text-muted">
              🔒 Phone numbers stay strictly masked from customers until you accept their job.
            </p>
          </div>

          {/* Short Bio */}
          <div>
            <label htmlFor="join-bio" className="label">
              Short Bio / Experience
            </label>
            <textarea
              id="join-bio"
              rows={2}
              placeholder="e.g. 8 years repairing home water pipelines and bathroom fittings."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="field resize-none text-sm"
            />
          </div>

          {/* Mock ID Upload */}
          <div className="rounded-md border-2 border-dashed border-ink/30 bg-wall p-4 space-y-3">
            <div>
              <label htmlFor="mock-id" className="block text-sm font-bold text-ink">
                📄 Mock Government ID Verification (Demo)
              </label>
              <p className="text-xs text-muted mt-0.5">
                Upload sample photo or document. (Processed in browser only — <b>nothing stored or uploaded</b>).
              </p>
            </div>

            <input
              id="mock-id"
              type="file"
              accept="image/*,application/pdf"
              onChange={handleMockUpload}
              className="block w-full text-xs text-ink file:mr-3 file:rounded-md file:border-0 file:bg-neel file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-neel-hover cursor-pointer"
            />

            {mockFileName && (
              <div className="flex items-center gap-2 rounded bg-paper p-2 text-xs font-semibold border border-ink/15">
                <span className="text-signal">✓ Selected file:</span>
                <span className="truncate">{mockFileName}</span>
              </div>
            )}

            {mockPreviewUrl && (
              <div className="mt-2 max-w-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mockPreviewUrl}
                  alt="Mock ID preview"
                  className="max-h-32 rounded border border-ink/20 object-contain shadow-sm"
                />
              </div>
            )}

            <div className="rounded bg-paper/60 p-2 text-[11px] text-muted italic">
              Verification status will initially be marked as <b>⏳ Pending verification</b>. An admin can review and toggle verification badges in the <code>/admin</code> panel.
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn btn-go w-full text-lg font-bold min-h-[48px] shadow-lg"
          >
            Submit Application
          </button>
        </form>
      </div>
    </div>
  );
}