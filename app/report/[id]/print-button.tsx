"use client";

import { Download, Printer } from "lucide-react";

export default function PrintButton() {
  return <div className="report-actions"><button onClick={() => window.print()}><Download /> Сформировать PDF</button><button className="secondary" onClick={() => window.print()}><Printer /> Печать</button></div>;
}
