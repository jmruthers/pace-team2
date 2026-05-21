import { useNavigate } from 'react-router-dom';
import { Button } from '@solvera/pace-core/components';
import { ChevronLeft } from '@solvera/pace-core/icons';

export function Member360NotFound() {
  const navigate = useNavigate();

  return (
    <main className="grid min-h-[50vh] place-items-center">
      <section className="grid gap-3 justify-items-center">
        <h1>Member not found</h1>
        <p>We couldn&apos;t find this member in your current organisation.</p>
        <Button type="button" variant="outline" onClick={() => navigate('/members')}>
          <ChevronLeft size={16} aria-hidden />
          Back to members
        </Button>
      </section>
    </main>
  );
}
