declare module 'react95' {
    type Size = 'sm' | 'md' | 'lg';

    type NumberFieldProps = {
        defaultValue: number;
        onChange: (value: number) => void;
        min: number;
        max: number;
        width: number;
    };

    type WindowProps = {
        resizable?: boolean;
    };

    type ButtonProps = {
        variant?: string;
        size?: Size;
        active?: boolean;
        ref?: any;
        primary?: boolean;
    };

    type CounterProps = {
        value: number;
        minLength?: number;
    };

    type ListItemProps = {
        size: Size;
    };

    type HourglassProps = {
        size: number;
    };

    type FieldsetProps = {
        label?: string;
    };

    export function NumberField<T>(
        props: NumberFieldProps & Omit<React.InputHTMLAttributes<T>, 'onChange'>
    ): JSX.Element;
    export function Window<T>(
        props: WindowProps & React.HTMLAttributes<T>
    ): JSX.Element;
    export function WindowContent<T>(
        props: React.HTMLAttributes<T>
    ): JSX.Element;
    export function WindowHeader<T>(
        props: React.HTMLAttributes<T>
    ): JSX.Element;
    export function Button<T>(
        props: ButtonProps & React.ButtonHTMLAttributes<T>
    ): JSX.Element;
    export function Anchor<T>(
        props: React.AnchorHTMLAttributes<T>
    ): JSX.Element;
    export function Toolbar<T>(props: React.HTMLAttributes<T>): JSX.Element;
    export function Counter<T>(
        props: CounterProps & React.HTMLAttributes<T>
    ): JSX.Element;
    export function List<T>(props: React.HTMLAttributes<T>): JSX.Element;
    export function ListItem<T>(
        props: ListItemProps & React.HTMLAttributes<T>
    ): JSX.Element;
    export function Divider<T>(props: React.HTMLAttributes<T>): JSX.Element;
    export function Hourglass<T>(
        props: HourglassProps & React.HTMLAttributes<T>
    ): JSX.Element;
    export function Fieldset<T>(
        props: FieldsetProps & React.FieldsetHTMLAttributes<T>
    ): JSX.Element;

    export const styleReset: any;
}
