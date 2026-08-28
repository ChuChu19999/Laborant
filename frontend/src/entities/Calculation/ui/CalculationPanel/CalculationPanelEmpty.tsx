interface CalculationPanelEmptyProps {
  title?: string;
  description: string;
}

const CalculationPanelEmpty = ({ title, description }: CalculationPanelEmptyProps) => {
  return (
    <div className="calculation-panel-empty">
      {title ? <h3 className="calculation-panel-empty-title">{title}</h3> : null}
      <p className="calculation-panel-empty-description">{description}</p>
    </div>
  );
};

export default CalculationPanelEmpty;
