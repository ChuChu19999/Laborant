import { Layout } from '@/shared/ui/Layout';
import { LoadingCard } from '@/shared/ui/LoadingCard';

const RouteFallback = () => {
  return (
    <Layout title={'\u00a0'}>
      <LoadingCard loading minDuration={0} />
    </Layout>
  );
};

export default RouteFallback;
