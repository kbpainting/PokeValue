import { AddCardForm } from '@/components/forms/add-card-form';

export default function AddCardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Add Card</h1>
        <p className="text-gray-400 mt-1">
          Search for a card, select grading details, and we&apos;ll pull live market comps.
        </p>
      </div>
      <AddCardForm />
    </div>
  );
}
