/** Turn a DDXPlus question into a short symptom label for chips and summaries:
 *  "Do you have a fever (either felt or measured with a thermometer)?" -> "Fever"
 *  "Do you have any lesions, redness or problems on your skin that ..." -> "Lesions, redness or problems on your skin" */
const LEADS = /^(do you (currently )?(have|feel|suffer from)|have you (recently )?(had|been|noticed|lost|felt|gained|vomited)?|are you (experiencing|feeling)?|did you|is your|does the|do your|are your)\s+/i;
const MAX = 46;

export function shortLabel(text: string): string {
  let t = text.replace(/\s*\([^)]*\)/g, "").replace(/\?\s*$/, "").trim();
  t = t.replace(LEADS, "").replace(/^(like|that)\s+(you are|you were|you)?\s*/i, "").replace(/^(a|an|any|the)\s+/i, "");
  t = t.split(/ that | which |, related | related to | in a significant way| or were you| or do you| or have you/i)[0].trim();
  if (t.length > MAX) t = t.slice(0, MAX).replace(/[\s,]+\S*$/, "") + "…";
  return t ? t[0].toUpperCase() + t.slice(1) : text;
}
