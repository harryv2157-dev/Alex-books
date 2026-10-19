import { currentReader } from "@/lib/auth";
import { buddyReadByCode } from "@/lib/buddy";
import { joinBuddyRead } from "@/app/actions";
import SignInButton from "@/components/SignInButton";

export const dynamic = "force-dynamic";

export default async function BuddyInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const read = await buddyReadByCode(code);
  const reader = await currentReader();

  return (
    <main className="landing">
      <div className="landing-card">
        {read ? (
          <>
            <p className="muted">{read.inviter?.split(" ")[0] ?? "A friend"} wants to read with you</p>
            <h1 style={{ fontSize: "2rem" }}>{read.title}</h1>
            {read.author ? <p>{read.author}</p> : null}
            <p className="muted small">
              You&rsquo;ll see each other&rsquo;s progress and notes, but never notes from pages you haven&rsquo;t reached yet.
            </p>
            {reader ? (
              <form action={joinBuddyRead.bind(null, code)}>
                <button className="btn btn-primary btn-lg">Read it together</button>
              </form>
            ) : (
              <SignInButton callbackUrl={`/buddy/${code}`} />
            )}
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "2rem" }}>Invite not found</h1>
            <p>This buddy-read link isn&rsquo;t valid. Ask for a new one.</p>
          </>
        )}
      </div>
    </main>
  );
}
