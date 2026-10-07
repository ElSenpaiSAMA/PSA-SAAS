import { describe, expect, it } from "vitest";
import { mentionedIds, mentionQueryAt, splitMentions, suggestMentions } from "./mentions";

const people = [
  { id: "ana", name: "Ana Torres" },
  { id: "diego", name: "Diego Fernández" },
  { id: "ana-maria", name: "Ana María López" },
];

describe("menciones en el texto", () => {
  it("separa las menciones del texto, con el nombre completo", () => {
    expect(splitMentions("@Diego Fernández ¿lo revisás? Gracias, @Ana Torres.", people)).toEqual([
      { type: "mention", text: "@Diego Fernández", id: "diego" },
      { type: "text", text: " ¿lo revisás? Gracias, " },
      { type: "mention", text: "@Ana Torres", id: "ana" },
      { type: "text", text: "." },
    ]);
  });

  it("no confunde nombres que empiezan igual ni marca emails", () => {
    expect(mentionedIds("Hola @Ana María López", people)).toEqual(["ana-maria"]);
    expect(mentionedIds("escribí a ana@Ana Torres.com", people)).toEqual([]);
  });

  it("si se borró la mención, esa persona ya no cuenta", () => {
    expect(mentionedIds("Lo veo yo, gracias", people)).toEqual([]);
  });
});

describe("autocompletar", () => {
  it("detecta lo que se está escribiendo tras el @", () => {
    expect(mentionQueryAt("Hola @Die", 9)).toEqual({ query: "Die", start: 5 });
    expect(mentionQueryAt("@", 1)).toEqual({ query: "", start: 0 });
    expect(mentionQueryAt("mail@dominio", 12)).toBeNull();
  });

  it("sugiere por cualquier palabra del nombre y sin tildes", () => {
    expect(suggestMentions("fern", people).map((p) => p.id)).toEqual(["diego"]);
    expect(suggestMentions("ana", people).map((p) => p.id)).toEqual(["ana", "ana-maria"]);
    expect(suggestMentions("lopez", people).map((p) => p.id)).toEqual(["ana-maria"]);
  });
});
