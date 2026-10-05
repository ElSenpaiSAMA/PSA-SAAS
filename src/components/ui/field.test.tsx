import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./field";
import { Input } from "./input";

describe("Field", () => {
  it("asocia label e input", () => {
    render(
      <Field label="Email">
        <Input name="email" />
      </Field>,
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("marca el input como inválido y lo describe con el error", () => {
    render(
      <Field label="Email" error={["Email inválido"]}>
        <Input name="email" />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Email inválido");
  });

  it("muestra el hint cuando no hay error", () => {
    render(
      <Field label="Horas" hint="En fracciones de 15 minutos">
        <Input name="hours" />
      </Field>,
    );
    const input = screen.getByLabelText("Horas");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input).toHaveAccessibleDescription("En fracciones de 15 minutos");
  });
});
