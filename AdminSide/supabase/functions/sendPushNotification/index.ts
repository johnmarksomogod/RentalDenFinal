import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  try {
    const { message, tokens } = await req.json();

    const responses = await Promise.all(
      tokens.map((token: string) =>
        fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: token,
            sound: "default",
            title: "New Booking",
            body: message,
          }),
        })
      )
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
