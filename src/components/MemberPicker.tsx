"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  name: string;
}

const COOKIE = "memberId";

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

export function MemberPicker() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActive(readCookie(COOKIE));
    fetch("/api/members")
      .then((r) => r.json())
      .then((d) => setMembers(d.members ?? []))
      .catch(() => setMembers([]));
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(id: string) {
    writeCookie(COOKIE, id);
    setActive(id);
    setOpen(false);
    router.refresh();
  }

  async function add() {
    const n = name.trim();
    if (!n) return;
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n }),
    });
    if (res.ok) {
      const d = await res.json();
      setMembers((m) => [...m, d.member]);
      setName("");
      pick(d.member.id);
    }
  }

  const activeName = members.find((m) => m.id === active)?.name;

  return (
    <div className="member-picker" ref={ref}>
      <button className="member-picker__btn" onClick={() => setOpen((o) => !o)}>
        <span className="member-picker__avatar">{(activeName ?? "?").charAt(0)}</span>
        {activeName ?? "מי אתה?"}
      </button>
      {open && (
        <div className="member-picker__menu">
          {members.map((m) => (
            <button
              key={m.id}
              className="member-picker__item"
              data-active={m.id === active}
              onClick={() => pick(m.id)}
            >
              {m.name}
            </button>
          ))}
          {members.length === 0 && <p className="member-picker__hint">הוסיפו בני משפחה</p>}
          <form
            className="member-picker__add"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם חדש"
              aria-label="הוספת בן משפחה"
            />
            <button type="submit" disabled={!name.trim()}>
              +
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
