import gladiatorsLogo from "@/assets/teams/team-gladiators.png";
import mavericksLogo from "@/assets/teams/team-mavericks.png";
import raidersLogo from "@/assets/teams/team-raiders.png";
import titansLogo from "@/assets/teams/team-titans.png";

/**
 * The four house crests, keyed by the codes the Groups tab uses. The names are
 * matched too, so a house that gets a new code in the sheet still finds its
 * crest instead of rendering a gap.
 */
const BY_CODE: Record<string, string> = {
  BMM: mavericksLogo,
  GG: gladiatorsLogo,
  RR: raidersLogo,
  TT: titansLogo,
};

const BY_KEYWORD: [string, string][] = [
  ["maverick", mavericksLogo],
  ["gladiator", gladiatorsLogo],
  ["raider", raidersLogo],
  ["titan", titansLogo],
];

export function teamLogo(team: { code?: string; name?: string }): string | undefined {
  const code = team.code?.trim().toUpperCase();
  if (code && BY_CODE[code]) return BY_CODE[code];
  const name = (team.name ?? "").toLowerCase();
  return BY_KEYWORD.find(([keyword]) => name.includes(keyword))?.[1];
}
